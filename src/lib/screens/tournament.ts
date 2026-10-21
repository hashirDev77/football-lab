import { FootballClient } from "../raw/client.js";
import { asArray, unwrapList, unwrapTournament } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import { STANDING_ROW, evaluateContract } from "../contracts/index.js";
import { normalizeMatches, normalizeSeason, normalizeStandings, normalizeTournament } from "../normalize/entities.js";
import type { StandingsType } from "../raw/types.js";

export async function loadTournaments(page = 1) {
  const ctx = new RequestContext("Competitions", "directory");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.tournaments(page, 30, { screen: "Competitions", component: "directory" });
  return {
    items: unwrapList(result.body)
      .map(normalizeTournament)
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    page,
    total: result.body?.total ?? 0,
    hasMore: Boolean(result.body?.hasMore),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournament(tournamentId: number) {
  const ctx = new RequestContext("Competition", "overview");
  ctx.minimum = 2;
  const client = new FootballClient(withClient(ctx).onCall);
  const [profile, seasons, events] = await Promise.all([
    client.uniqueTournament(tournamentId, { screen: "Competition", component: "overview" }),
    client.uniqueTournamentSeasons(tournamentId, 1, 20, { screen: "Competition", component: "seasons" }),
    client.uniqueTournamentEvents(tournamentId, 1, 10, { screen: "Competition", component: "current matches" }),
  ]);
  ctx.parallel += 3;
  const tournament = normalizeTournament(unwrapTournament(profile.body) || profile.body);
  if (profile.status === 200 && tournament && !tournament.country && !tournament.logo && !tournament.currentSeasonId) {
    ctx.recordGap({
      code: "TOURNAMENT_PROFILE_THIN",
      type: "MISSING_FIELD",
      severity: "P2",
      endpoint: `/unique-tournament/${tournamentId}`,
      expected: "name, logo, region, category, current season",
      actual: `keys=${Object.keys(profile.body || {}).join(",")}`,
      userImpact: "Competition overview is name-only.",
      developerImpact: "Need extra calls for a usable competition header.",
    });
  }
  const seasonList = unwrapList(seasons.body)
    .map(normalizeSeason)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  store.addRelationship({
    from: `tournament:${tournamentId}`,
    to: `season:${seasonList[0]?.id}`,
    idExists: seasonList.length > 0,
    idResolves: true,
    nameMatches: true,
    agreed: true,
    notes: `${seasonList.length} seasons`,
  });
  return {
    tournament,
    seasons: seasonList,
    currentSeasonId: tournament?.currentSeasonId ?? seasonList[0]?.id ?? null,
    matches: normalizeMatches(events.body, ctx, "list"),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournamentMatches(tournamentId: number, date?: string) {
  const ctx = new RequestContext("Competition", "matches");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = date
    ? await client.uniqueTournamentScheduled(tournamentId, date, { screen: "Competition", component: "scheduled" })
    : await client.uniqueTournamentEvents(tournamentId, 1, 40, { screen: "Competition", component: "matches" });
  const matches = normalizeMatches(result.body, ctx, "list");
  const byDay = new Map<string, typeof matches>();
  for (const match of matches) {
    const day = match.startTime ? match.startTime.slice(0, 10) : "Unknown date";
    const list = byDay.get(day) || [];
    list.push(match);
    byDay.set(day, list);
  }
  return {
    days: [...byDay.entries()].map(([dateKey, items]) => ({ date: dateKey, matches: items })),
    live: matches.filter((m) => m.status.label === "Live" || m.status.label === "Halftime"),
    upcoming: matches.filter((m) => m.status.label === "Upcoming"),
    completed: matches.filter((m) => m.status.label === "Completed"),
    dateFilter: date || null,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournamentSeasons(tournamentId: number) {
  const ctx = new RequestContext("Competition", "seasons");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.uniqueTournamentSeasons(tournamentId, 1, 30, {
    screen: "Competition",
    component: "seasons",
  });
  return {
    tournamentId,
    seasons: unwrapList(result.body)
      .map(normalizeSeason)
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTournamentStandings(
  tournamentId: number,
  seasonId: number,
  type: StandingsType = "total",
) {
  const ctx = new RequestContext("Competition", "standings");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.uniqueTournamentStandings(tournamentId, seasonId, type, {
    screen: "Competition",
    component: "standings",
  });
  const rows = normalizeStandings(result.body);
  for (const row of rows.slice(0, 5)) {
    evaluateContract(ctx, `/unique-tournament/${tournamentId}/season/${seasonId}/standings/${type}`, "standing row", {
      team: row.team.name,
      position: row.position,
      played: row.played,
      points: row.points,
      goalDifference: row.goalDifference,
    }, STANDING_ROW);
  }
  store.addRelationship({
    from: `season:${seasonId}`,
    to: "standings",
    idExists: rows.length > 0,
    idResolves: true,
    nameMatches: true,
    agreed: rows.every((row) => row.team.id != null),
    notes: `${type} ${rows.length} rows`,
  });
  const columns = ["position", "team", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "goalDifference", "points", "form"].filter(
    (col) =>
      rows.some((row) => {
        if (col === "team") return row.team.name;
        return (row as unknown as Record<string, unknown>)[col] != null;
      }),
  );
  return { tournamentId, seasonId, type, columns, rows, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadTournamentRound(tournamentId: number, seasonId: number, round: string) {
  const ctx = new RequestContext("Competition", "round");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.uniqueTournamentRound(tournamentId, seasonId, round, {
    screen: "Competition",
    component: "round",
  });
  const matches = normalizeMatches(result.body, ctx, "list");
  if (!matches.length && asArray(result.body?.events).length === 0 && result.status === 200) {
    ctx.recordGap({
      code: "ROUND_EMPTY",
      type: "EMPTY_RESPONSE",
      severity: "P2",
      endpoint: `/unique-tournament/${tournamentId}/season/${seasonId}/round/${round}`,
      expected: "fixtures for the requested matchday",
      actual: "empty",
      userImpact: "Users cannot navigate matchdays.",
      developerImpact: "Round ids/names may not match season payload.",
    });
  }
  return {
    tournamentId,
    seasonId,
    round,
    matches,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}
