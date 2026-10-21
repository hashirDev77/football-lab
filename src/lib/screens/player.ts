import { FootballClient } from "../raw/client.js";
import { asRecord, unwrapList, unwrapPlayer } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { evaluatePlayerContract } from "../contracts/index.js";
import { normalizeMatches, normalizePlayer } from "../normalize/entities.js";
import { store } from "../gaps/store.js";

export async function loadPlayer(playerId: number) {
  const ctx = new RequestContext("Player", "overview");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const result = await client.player(playerId, { screen: "Player", component: "overview" });
  const player = normalizePlayer(unwrapPlayer(result.body) || result.body);
  if (!player) {
    return { error: result.error || "This information could not be loaded.", _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }
  evaluatePlayerContract(ctx, player);
  store.addRelationship({
    from: `player:${player.id}`,
    to: `team:${player.team?.id}`,
    idExists: player.team?.id != null,
    idResolves: null,
    nameMatches: Boolean(player.team?.name),
    agreed: player.team?.id != null,
    notes: "player → team",
  });
  return { player, rawMissing: collectMissingProfile(player), _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}

function collectMissingProfile(player: ReturnType<typeof normalizePlayer>) {
  if (!player) return [];
  return (["team", "country", "position", "shirtNumber", "age", "dateOfBirth", "height", "image"] as const).filter((key) => {
    const value = player[key];
    return value == null || (typeof value === "object" && value && "id" in value && value.id == null && !value.name);
  });
}

export async function loadPlayerMatches(playerId: number) {
  const ctx = new RequestContext("Player", "matches");
  ctx.minimum = 2;
  const client = new FootballClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const [last, next] = await Promise.all([
    client.playerEvents(playerId, "last", 1, 10, { screen: "Player", component: "Recent matches" }),
    client.playerEvents(playerId, "next", 1, 10, { screen: "Player", component: "Upcoming matches" }),
  ]);
  ctx.parallel += 2;
  const recent = normalizeMatches(last.body, ctx, "list");
  const upcoming = normalizeMatches(next.body, ctx, "list");
  store.addRelationship({
    from: `player:${playerId}`,
    to: "events",
    idExists: recent.length + upcoming.length > 0,
    idResolves: true,
    nameMatches: null,
    agreed: true,
    notes: `last total=${last.body?.total ?? recent.length}`,
  });
  return {
    recent,
    upcoming,
    totals: { last: last.body?.total ?? recent.length, next: next.body?.total ?? upcoming.length },
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadPlayerStatistics(playerId: number, tournamentId?: number, seasonId?: number) {
  const ctx = new RequestContext("Player", "season");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);
  if (!tournamentId || !seasonId) {
    const events = await client.playerEvents(playerId, "last", 1, 5, { screen: "Player", component: "discover-season" });
    const first = asRecord(unwrapList(events.body)[0]);
    tournamentId = Number(asRecord(first?.uniqueTournament)?.id) || Number(first?.tournamentId) || undefined;
    seasonId = Number(asRecord(first?.season)?.id) || undefined;
  }
  if (!tournamentId || !seasonId) {
    ctx.recordGap({
      code: "PLAYER_STATS_IDS_MISSING",
      type: "EXTRA_REQUEST_REQUIRED",
      severity: "P2",
      endpoint: `/player/${playerId}/unique-tournament/{tid}/season/{sid}/statistics`,
      expected: "discoverable tournamentId and seasonId from player events",
      actual: "could not resolve IDs",
      userImpact: "Season statistics cannot be requested without extra lookups.",
      developerImpact: "Need a player-level statistics index.",
    });
    return {
      available: false,
      tournamentId,
      seasonId,
      raw: null,
      _meta: { calls: ctx.meta(), gaps: ctx.gaps },
    };
  }
  ctx.sequential += 1;
  const result = await client.playerSeasonStatistics(playerId, tournamentId, seasonId, {
    screen: "Player",
    component: "season",
  });
  if (result.status === 404) {
    ctx.recordGap({
      code: "PLAYER_SEASON_STATS_COVERAGE",
      type: "OPTIONAL_404",
      severity: "P1",
      endpoint: `/player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics`,
      expected: "season statistics for squad members",
      actual: result.error || "404",
      userImpact: "No statistics available for this season.",
      developerImpact: "Same season can 200 for one player and 404 for another.",
      recommendation: "Publish coverage or a player-level statistics index.",
    });
    return {
      available: false,
      tournamentId,
      seasonId,
      raw: null,
      _meta: { calls: ctx.meta(), gaps: ctx.gaps },
    };
  }
  const stats = asRecord(result.body?.statistics) || asRecord(result.body) || {};
  return {
    available: true,
    tournamentId,
    seasonId,
    player: normalizePlayer(unwrapPlayer(result.body) || result.body),
    raw: stats,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadPlayersDirectory(page = 1) {
  const ctx = new RequestContext("Players directory", "list");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.players(page, 20, { screen: "Players directory", component: "list" });
  const items = unwrapList(result.body)
    .map((row) => normalizePlayer(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return {
    items,
    page,
    total: result.body?.total ?? items.length,
    hasMore: Boolean(result.body?.hasMore),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}
