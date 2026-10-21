import { FootballClient } from "../raw/client.js";
import { asArray, asRecord, unwrapEvent, unwrapList, unwrapTeam, widgetFromResult } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import {
  normalizeMatch,
  normalizeMatches,
  normalizePlayer,
  normalizeTournament,
  positionGroup,
} from "../normalize/entities.js";

export async function loadTeam(teamId: number) {
  const ctx = new RequestContext("Team", "overview");
  ctx.minimum = 4;
  const client = new FootballClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const [profile, near, performance, featured] = await Promise.all([
    client.team(teamId, { screen: "Team", component: "overview" }),
    client.teamNearEvents(teamId, { screen: "Team", component: "near-events" }),
    client.teamPerformance(teamId, { screen: "Team", component: "performance" }),
    client.teamFeaturedEvent(teamId, { screen: "Team", component: "featured-event" }),
  ]);
  ctx.parallel += 4;

  const team = asRecord(unwrapTeam(profile.body) || profile.body);
  if (!team) {
    return { error: profile.error || "This information could not be loaded.", _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }

  const featuredEvent = unwrapEvent(featured.body);
  ctx.recordGap({
    code: "FEATURED_EVENT_SEMANTICS_UNCLEAR",
    type: "DOCUMENTATION_GAP",
    severity: "P2",
    endpoint: `/team/${teamId}/featured-event`,
    expected: "documented meaning vs near-events",
    actual: featuredEvent ? `event ${featuredEvent.id} status=${JSON.stringify(featuredEvent.status)}` : "event=null",
    userImpact: "Featured match may be finished or empty while the team is playing live elsewhere.",
    developerImpact: "Do not use featured-event as the live match resolver.",
    recommendation: "Use near-events, events/last, events/next, or global live events.",
  });

  const previous = normalizeMatch(asRecord(near.body?.previousEvent), ctx, "event");
  const next = normalizeMatch(asRecord(near.body?.nextEvent), ctx, "event");
  store.addRelationship({
    from: `team:${teamId}`,
    to: "events",
    idExists: Boolean(previous || next),
    idResolves: true,
    nameMatches: null,
    agreed: true,
    notes: "near-events used for current match, not featured-event",
  });

  const rankingScopeMissing = performance.body && !asRecord(performance.body)?.competition && !asRecord(performance.body)?.tournament;
  if (rankingScopeMissing) {
    ctx.recordGap({
      code: "RANKING_SCOPE_UNCLEAR",
      type: "DOCUMENTATION_GAP",
      severity: "P3",
      endpoint: `/team/${teamId}/performance`,
      expected: "scope for performance metrics",
      actual: `keys=${Object.keys(performance.body || {}).join(",")}`,
      userImpact: "Performance numbers have no competition context.",
      developerImpact: "Document the window and competition for performance.",
    });
  }

  return {
    team: {
      id: teamId,
      name: team.name,
      country: asRecord(team.country)?.name || team.country || null,
      logo: team.logo || team.image || null,
      managerId: asRecord(team.manager)?.id || team.managerId || null,
    },
    previousMatch: previous,
    nextMatch: next,
    featuredEvent: featuredEvent ? normalizeMatch(featuredEvent, ctx, "event") : null,
    featuredIsEditorial: true,
    performance: widgetFromResult(performance, "Performance data is unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamMatches(teamId: number) {
  const ctx = new RequestContext("Team", "matches");
  ctx.minimum = 2;
  const client = new FootballClient(withClient(ctx).onCall);
  const [last, next, near] = await Promise.all([
    client.teamEvents(teamId, "last", 1, 15, { screen: "Team", component: "results" }),
    client.teamEvents(teamId, "next", 1, 15, { screen: "Team", component: "fixtures" }),
    client.teamNearEvents(teamId, { screen: "Team", component: "near-events" }),
  ]);
  ctx.parallel += 3;
  return {
    results: normalizeMatches(last.body, ctx, "list"),
    fixtures: normalizeMatches(next.body, ctx, "list"),
    near: {
      previous: normalizeMatch(asRecord(near.body?.previousEvent), ctx, "event"),
      next: normalizeMatch(asRecord(near.body?.nextEvent), ctx, "event"),
    },
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamSquad(teamId: number) {
  const ctx = new RequestContext("Team", "squad");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teamPlayers(teamId, { screen: "Team", component: "squad" });
  const players = unwrapList(result.body)
    .map(normalizePlayer)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const grouped = {
    goalkeepers: players.filter((player) => positionGroup(player.position) === "goalkeepers"),
    defenders: players.filter((player) => positionGroup(player.position) === "defenders"),
    midfielders: players.filter((player) => positionGroup(player.position) === "midfielders"),
    forwards: players.filter((player) => positionGroup(player.position) === "forwards"),
    unknown: players.filter((player) => positionGroup(player.position) === "unknown"),
  };
  if (!players.length && result.status === 200) {
    ctx.recordGap({
      code: "TEAM_SQUAD_EMPTY",
      type: "EMPTY_RESPONSE",
      severity: "P1",
      endpoint: `/team/${teamId}/players`,
      expected: "squad with player IDs",
      actual: "empty list",
      userImpact: "Team squad tab cannot be built.",
      developerImpact: "Directory exists but team-scoped roster is empty.",
    });
  }
  if (grouped.unknown.length === players.length && players.length) {
    ctx.recordGap({
      code: "TEAM_PLAYER_POSITION_MISSING",
      type: "MISSING_FIELD",
      severity: "P2",
      endpoint: `/team/${teamId}/players`,
      field: "position",
      expected: "position sufficient to group GK / DF / MF / FW",
      actual: "position missing or unusable",
      userImpact: "Squad cannot be grouped the way a football product expects.",
      developerImpact: "Must show a flat list or infer position from other fields.",
    });
  }
  store.addRelationship({
    from: `team:${teamId}`,
    to: "players",
    idExists: players.length > 0,
    idResolves: true,
    nameMatches: true,
    agreed: true,
    notes: `${players.length} squad players`,
  });
  return {
    players,
    grouped,
    widget: widgetFromResult(result, "Squad data is unavailable — not the same as an empty squad."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamPerformance(teamId: number) {
  const ctx = new RequestContext("Team", "performance");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teamPerformance(teamId, { screen: "Team", component: "performance" });
  const body = result.body || {};
  const metrics = Object.entries(body)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .map(([name, value]) => ({ name, value }));
  return {
    events: asArray(body.events),
    points: body.points ?? null,
    metrics,
    raw: body,
    widget: widgetFromResult(result, "Performance data is unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamRankings(teamId: number) {
  const ctx = new RequestContext("Team", "rankings");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teamRankings(teamId, 1, 20, { screen: "Team", component: "rankings" });
  const items = unwrapList(result.body);
  if (items.length && items.every((item) => !asRecord(item)?.type && !asRecord(item)?.competition && !asRecord(item)?.uniqueTournament)) {
    ctx.recordGap({
      code: "RANKING_SCOPE_UNCLEAR",
      type: "DOCUMENTATION_GAP",
      severity: "P2",
      endpoint: `/team/${teamId}/rankings`,
      expected: "ranking context (world, country, competition)",
      actual: `keys=${Object.keys(asRecord(items[0]) || {}).join(",")}`,
      userImpact: "Ranking in what context?",
      developerImpact: "Do not invent ranking scope.",
    });
  }
  return {
    items,
    total: result.body?.total ?? 0,
    widget: widgetFromResult(result, "Rankings are unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamCompetitions(teamId: number) {
  const ctx = new RequestContext("Team", "competitions");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teamUniqueTournaments(teamId, 1, 30, { screen: "Team", component: "competitions" });
  return {
    items: unwrapList(result.body)
      .map(normalizeTournament)
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamStandingsSeasons(teamId: number) {
  const ctx = new RequestContext("Team", "standings-seasons");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teamStandingsSeasons(teamId, 1, 30, { screen: "Team", component: "standings-seasons" });
  return {
    items: unwrapList(result.body),
    widget: widgetFromResult(result, "Standings seasons are unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamStatistics(teamId: number, tournamentId?: number, seasonId?: number) {
  const ctx = new RequestContext("Team", "statistics");
  const client = new FootballClient(withClient(ctx).onCall);
  if (!tournamentId || !seasonId) {
    const tournaments = await client.teamUniqueTournaments(teamId, 1, 10, { screen: "Team", component: "competitions" });
    const first = asRecord(unwrapList(tournaments.body)[0]);
    tournamentId = Number(first?.id) || undefined;
    const seasons = tournamentId
      ? await client.uniqueTournamentSeasons(tournamentId, 1, 5, { screen: "Team", component: "seasons" })
      : null;
    seasonId = Number(asRecord(unwrapList(seasons?.body || null)[0])?.id) || undefined;
  }
  if (!tournamentId || !seasonId) {
    ctx.recordGap({
      code: "TEAM_STATS_IDS_MISSING",
      type: "EXTRA_REQUEST_REQUIRED",
      severity: "P2",
      endpoint: `/team/${teamId}/unique-tournament/{tid}/season/{sid}/statistics`,
      expected: "discoverable tournamentId and seasonId",
      actual: "could not resolve IDs",
      userImpact: "Season statistics cannot be requested.",
      developerImpact: "Need unique-tournaments + seasons first.",
    });
    return { available: false, tournamentId, seasonId, raw: null, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }
  const result = await client.teamSeasonStatistics(teamId, tournamentId, seasonId, {
    screen: "Team",
    component: "season-statistics",
  });
  return {
    available: result.status === 200,
    tournamentId,
    seasonId,
    raw: result.body,
    widget: widgetFromResult(result, "Team season statistics are unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTeamMedia(teamId: number) {
  const ctx = new RequestContext("Team", "media");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teamMedia(teamId, 1, 20, { screen: "Team", component: "media" });
  return { items: unwrapList(result.body), widget: widgetFromResult(result, "No media assets."), _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadTeamEnrichments(teamId: number, type?: string) {
  const ctx = new RequestContext("Team", "enrichments");
  const client = new FootballClient(withClient(ctx).onCall);
  const catalogue = await client.teamEnrichments(teamId, { screen: "Team", component: "enrichments" });
  const types = asArray(catalogue.body?.types)
    .map((item) => (typeof item === "string" ? item : String(asRecord(item)?.type || asRecord(item)?.name || "")))
    .filter(Boolean);
  let selected = null;
  const pick = type || types[0];
  if (pick) {
    const typed = await client.teamEnrichmentType(teamId, pick, { screen: "Team", component: `enrichment:${pick}` });
    selected = { type: pick, ...widgetFromResult(typed, `Enrichment '${pick}' is unavailable.`), raw: typed.body };
  }
  return { types, selected, widget: widgetFromResult(catalogue, "No team enrichments."), _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

export async function loadTeamsDirectory(page = 1) {
  const ctx = new RequestContext("Teams directory", "list");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.teams(page, 20, { screen: "Teams directory", component: "list" });
  return {
    items: unwrapList(result.body),
    page,
    total: result.body?.total ?? 0,
    hasMore: Boolean(result.body?.hasMore),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadManager(managerId: number) {
  const ctx = new RequestContext("Manager", "profile");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.manager(managerId, { screen: "Manager", component: "profile" });
  const manager = asRecord(result.body?.manager) || result.body;
  if (result.status === 404) {
    ctx.recordGap({
      code: "MANAGER_NOT_FOUND",
      type: "OPTIONAL_404",
      severity: "P2",
      endpoint: `/manager/${managerId}`,
      expected: "manager profile when lineup/team emitted an id",
      actual: result.error || "404",
      userImpact: "Staff links from lineups can 404.",
      developerImpact: "Manager IDs on other payloads may not resolve.",
    });
  }
  const missing = ["name", "nationality", "team", "age", "photo"].filter((field) => {
    const rec = asRecord(manager);
    return rec && rec[field] == null && rec[field === "photo" ? "image" : field] == null;
  });
  return { manager, status: result.status, missing, _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}
