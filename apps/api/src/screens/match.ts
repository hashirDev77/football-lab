import { FootballClient } from "../raw/client.js";
import { asArray, asRecord, isEmptyPayload, isOptionalEnrichment404, unwrapEvent, unwrapList, widgetFromResult } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import { INCIDENT, LINEUP_SIDE, evaluateContract } from "../contracts/index.js";
import {
  classify,
  normalizeIncident,
  normalizeLineupSide,
  normalizeMatch,
  normalizeMatches,
  normalizeStatistics,
} from "../normalize/entities.js";
import type { HealthCheck } from "../gaps/types.js";

function health(checks: HealthCheck[]) {
  const available = checks.filter((item) => item.status === "AVAILABLE").length;
  return {
    checks,
    coverage: checks.length ? Math.round((available / checks.length) * 100) : 0,
  };
}

export async function loadMatchOverview(eventId: number) {
  const ctx = new RequestContext("Match Centre", "header");
  ctx.minimum = 4;
  const client = new FootballClient(withClient(ctx).onCall);

  ctx.sequential += 1;
  const [eventRes, form, streaks, weather] = await Promise.all([
    client.event(eventId, { screen: "Match Centre", component: "header" }),
    client.eventPregameForm(eventId, { screen: "Match Centre", component: "Pregame form" }),
    client.eventTeamStreaks(eventId, { screen: "Match Centre", component: "Team streaks" }),
    client.eventWeather(eventId, { screen: "Match Centre", component: "Weather" }),
  ]);
  ctx.parallel += 4;

  const match = normalizeMatch(unwrapEvent(eventRes.body) || eventRes.body, ctx, "event");
  if (!match && eventRes.status !== 200) {
    return { error: eventRes.error || "This information could not be loaded.", _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
  }

  if (match) {
    store.addRelationship({
      from: `match:${match.id}`,
      to: `competition:${match.tournament.id}`,
      idExists: match.tournament.id != null,
      idResolves: null,
      nameMatches: Boolean(match.tournament.name),
      agreed: match.tournament.id != null,
      notes: match.tournament.id == null ? "uniqueTournament.id null on detail" : "ok",
    });
    store.addRelationship({
      from: `match:${match.id}`,
      to: `team:${match.homeTeam.id}/${match.awayTeam.id}`,
      idExists: Boolean(match.homeTeam.id && match.awayTeam.id),
      idResolves: null,
      nameMatches: Boolean(match.homeTeam.name && match.awayTeam.name),
      agreed: Boolean(match.homeTeam.id && match.awayTeam.id),
      notes: "match → teams",
    });
  }

  const formWidget = widgetFromResult(form, "Pre-game form is unavailable.");
  const streaksWidget = widgetFromResult(streaks, "Team streak information is not available for this match.");
  const weatherWidget = widgetFromResult(weather, "Weather data is unavailable for this match.");
  if (weatherWidget.status === "EMPTY" || weatherWidget.status === "OPTIONAL_404") {
    ctx.recordGap({
      code: "MATCH_WEATHER_UNAVAILABLE",
      type: weather.status === 404 ? "OPTIONAL_404" : "EMPTY_RESPONSE",
      severity: "P3",
      endpoint: `/event/${eventId}/weather`,
      expected: "weather payload when the venue has conditions",
      actual: String(weather.status),
      userImpact: "Weather widget cannot be shown.",
      developerImpact: "Empty vs unsupported cannot be distinguished from docs.",
    });
  }

  return {
    match,
    form: formWidget,
    teamStreaks: streaksWidget,
    weather: weatherWidget,
    venue: match?.venue ?? null,
    health: health([
      { field: "competition", status: classify(match?.tournament.name), expected: "competition name", actual: String(match?.tournament.name ?? "missing") },
      { field: "round", status: classify(match?.round), expected: "round", actual: String(match?.round ?? "missing") },
      { field: "homeTeam", status: classify(match?.homeTeam.name), expected: "home team", actual: String(match?.homeTeam.name ?? "missing") },
      { field: "awayTeam", status: classify(match?.awayTeam.name), expected: "away team", actual: String(match?.awayTeam.name ?? "missing") },
      { field: "score", status: classify(match?.score.home.current ?? match?.score.away.current), expected: "score", actual: String(match?.score.home.display ?? "missing") },
      { field: "status", status: classify(match?.status.label), expected: "status", actual: String(match?.status.label ?? "missing") },
      { field: "minute", status: classify(match?.minute), expected: "minute", actual: String(match?.minute ?? "missing") },
      { field: "kickoff", status: classify(match?.startTime), expected: "kickoff", actual: String(match?.startTime ?? "missing") },
      { field: "venue", status: classify(match?.venue), expected: "venue", actual: String(match?.venue ?? "missing") },
      { field: "referee", status: classify(match?.referee), expected: "referee", actual: String(match?.referee ?? "missing") },
      { field: "season", status: classify(match?.season), expected: "season", actual: String(match?.season ?? "missing") },
    ]),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadTimeline(eventId: number) {
  const ctx = new RequestContext("Match Centre", "timeline");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.eventIncidents(eventId, { screen: "Match Centre", component: "timeline" });
  const incidents = (asArray(result.body?.incidents).length ? asArray(result.body?.incidents) : unwrapList(result.body)).map(
    normalizeIncident,
  );
  for (const incident of incidents) {
    evaluateContract(ctx, `/event/${eventId}/incidents`, "timeline", incident, INCIDENT);
    if (incident.playerName && !incident.playerId) {
      ctx.recordGap({
        code: "INCIDENT_MISSING_IDS",
        type: "BROKEN_RELATIONSHIP",
        severity: "P1",
        endpoint: `/event/${eventId}/incidents`,
        field: "playerId",
        expected: "playerId when player name is present",
        actual: incident.playerName,
        userImpact: "Timeline cannot open the scorer or booked player.",
        developerImpact: "Name-only incidents break entity navigation.",
      });
    }
  }
  const widget = widgetFromResult(result, "No incidents are available for this match.");
  return {
    incidents,
    widget,
    health: health([
      { field: "incidents", status: incidents.length ? "AVAILABLE" : "MISSING", expected: "timeline events", actual: String(incidents.length) },
      { field: "playerIds", status: incidents.some((i) => i.playerId) ? "AVAILABLE" : "MISSING", expected: "player IDs", actual: incidents.filter((i) => i.playerId).length + " with ids" },
      { field: "teamIds", status: incidents.some((i) => i.teamId) ? "AVAILABLE" : "MISSING", expected: "team IDs", actual: incidents.filter((i) => i.teamId).length + " with ids" },
    ]),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadLineups(eventId: number) {
  const ctx = new RequestContext("Match Centre", "lineups");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.eventLineups(eventId, { screen: "Match Centre", component: "lineups" });
  const body = result.body;
  const home = normalizeLineupSide(body?.home);
  const away = normalizeLineupSide(body?.away);
  const confirmed = typeof body?.confirmed === "boolean" ? body.confirmed : null;
  if (home) evaluateContract(ctx, `/event/${eventId}/lineups`, "home lineup", home, LINEUP_SIDE);
  if (away) evaluateContract(ctx, `/event/${eventId}/lineups`, "away lineup", away, LINEUP_SIDE);
  if ((home && home.starters.length !== 11) || (away && away.starters.length !== 11)) {
    ctx.recordGap({
      code: "LINEUP_INCOMPLETE",
      type: "MISSING_FIELD",
      severity: "P2",
      endpoint: `/event/${eventId}/lineups`,
      expected: "11 starters per side",
      actual: `home=${home?.starters.length ?? 0} away=${away?.starters.length ?? 0}`,
      userImpact: "Starting XI cannot be shown as a real lineup.",
      developerImpact: "Lineup payload may mix substitutes or omit players.",
    });
  }
  if (confirmed == null && (home || away)) {
    ctx.recordGap({
      code: "LINEUP_CONFIRMED_FLAG_MISSING",
      type: "DOCUMENTATION_GAP",
      severity: "P3",
      endpoint: `/event/${eventId}/lineups`,
      field: "confirmed",
      expected: "confirmed vs expected indicator",
      actual: "missing",
      userImpact: "Users cannot tell predicted XI from confirmed XI.",
      developerImpact: "Document or emit a confirmed boolean.",
    });
  }
  store.addRelationship({
    from: `match:${eventId}`,
    to: "lineup players",
    idExists: Boolean(home?.starters.some((p) => p.playerId) || away?.starters.some((p) => p.playerId)),
    idResolves: null,
    nameMatches: true,
    agreed: Boolean(home?.starters.some((p) => p.playerId)),
    notes: "lineup → player",
  });
  return {
    home,
    away,
    confirmed,
    widget: widgetFromResult(result, "Lineups are not available for this match."),
    health: health([
      { field: "homeXI", status: (home?.starters.length || 0) >= 11 ? "AVAILABLE" : "PARTIAL", expected: "11 starters", actual: String(home?.starters.length ?? 0) },
      { field: "awayXI", status: (away?.starters.length || 0) >= 11 ? "AVAILABLE" : "PARTIAL", expected: "11 starters", actual: String(away?.starters.length ?? 0) },
      { field: "playerIds", status: home?.starters.some((p) => p.playerId) ? "AVAILABLE" : "MISSING", expected: "player IDs", actual: "see lineup" },
      { field: "positions", status: home?.starters.some((p) => p.position) ? "AVAILABLE" : "MISSING", expected: "positions", actual: "see lineup" },
      { field: "shirtNumbers", status: home?.starters.some((p) => p.shirtNumber != null) ? "AVAILABLE" : "MISSING", expected: "shirt numbers", actual: "see lineup" },
      { field: "formation", status: classify(home?.formation), expected: "formation", actual: String(home?.formation ?? "missing") },
      { field: "manager", status: classify(home?.managerId), expected: "manager id", actual: String(home?.managerId ?? "missing") },
      { field: "confirmed", status: confirmed == null ? "MISSING" : "AVAILABLE", expected: "confirmed/expected", actual: String(confirmed) },
    ]),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadStatistics(eventId: number) {
  const ctx = new RequestContext("Match Centre", "statistics");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.eventStatistics(eventId, { screen: "Match Centre", component: "statistics" });
  const rows = normalizeStatistics(result.body);
  if (result.status === 200 && !rows.length) {
    ctx.recordGap({
      code: "MATCH_STATISTICS_EMPTY",
      type: "EMPTY_RESPONSE",
      severity: "P2",
      endpoint: `/event/${eventId}/statistics`,
      expected: "dynamic statistic rows",
      actual: "no parseable statistics",
      userImpact: "Match statistics tab is empty.",
      developerImpact: "Statistic shape is undocumented or competition-specific.",
    });
  }
  return {
    rows,
    raw: result.body,
    widget: widgetFromResult(result, "Match statistics are unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadPlayerStatistics(eventId: number, playerId?: number) {
  const ctx = new RequestContext("Match Centre", "player-statistics");
  const client = new FootballClient(withClient(ctx).onCall);
  const list = await client.eventPlayerStatistics(eventId, { screen: "Match Centre", component: "player-statistics" });
  let detail = null;
  if (playerId) {
    detail = await client.eventPlayerStatisticsById(eventId, playerId, {
      screen: "Match Centre",
      component: "player-statistics-by-id",
    });
    if (detail.status === 404) {
      ctx.recordGap({
        code: "PLAYER_MATCH_STATS_404",
        type: "OPTIONAL_404",
        severity: "P2",
        endpoint: `/event/${eventId}/player/${playerId}/statistics`,
        expected: "200 even when the player is not in the XI, or a documented empty payload",
        actual: detail.error || "404",
        userImpact: "Drilling into a player from the match can look like the match itself is missing.",
        developerImpact: "404 is overloaded for 'player not in this match'.",
      });
    }
  }
  const players = unwrapList(list.body);
  return {
    players,
    detail: detail ? widgetFromResult(detail, "This player's match statistics are unavailable.") : null,
    widget: widgetFromResult(list, "Player statistics are unavailable for this match."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadBestPlayers(eventId: number) {
  const ctx = new RequestContext("Match Centre", "best-players");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.eventBestPlayers(eventId, { screen: "Match Centre", component: "best-players" });
  if (result.status === 200 && result.body && !asRecord(result.body)?.playerOfTheMatch && isEmptyPayload(result.body) === false) {
    ctx.recordGap({
      code: "BEST_PLAYERS_SEMANTICS_UNCLEAR",
      type: "DOCUMENTATION_GAP",
      severity: "P3",
      endpoint: `/event/${eventId}/best-players`,
      expected: "documented ranking rule (rating, goals, editorial)",
      actual: `keys=${Object.keys(result.body).join(",")}`,
      userImpact: "UI cannot explain why a player is 'best'.",
      developerImpact: "Do not guess ranking semantics.",
    });
  }
  return {
    widget: widgetFromResult(result, "Best player information is not available for this match."),
    raw: result.body,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadH2H(eventId: number) {
  const ctx = new RequestContext("Match Centre", "h2h");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.eventH2h(eventId, { screen: "Match Centre", component: "h2h" });
  const body = result.body || {};
  const teamDuel = asRecord(body.teamDuel);
  const events = normalizeMatches(
    asRecord(body.teamDuel) ? { events: asArray(asRecord(asRecord(body)?.events)?.events).length ? asArray((body as { events?: unknown }).events) : unwrapList(body) } : body,
    ctx,
    "list",
  );
  const historical = events.length
    ? events
    : normalizeMatches({ events: asArray(asRecord(body)?.events) } as never, ctx, "list");
  const extra = unwrapList(asRecord(body.teamDuel) ? null : body);
  const meetings = historical.length
    ? historical
    : extra.map((item) => normalizeMatch(item, ctx, "list")).filter((item): item is NonNullable<typeof item> => Boolean(item));
  for (const meeting of meetings) {
    if (!meeting.id) {
      ctx.recordGap({
        code: "H2H_EVENT_ID_MISSING",
        type: "BROKEN_RELATIONSHIP",
        severity: "P2",
        endpoint: `/event/${eventId}/h2h`,
        expected: "eventId on historical meetings",
        actual: "missing",
        userImpact: "Previous meetings cannot be opened.",
        developerImpact: "H2H is a dead-end without IDs.",
      });
    }
  }
  return {
    teamDuel,
    meetings,
    raw: body,
    widget: widgetFromResult(result, "Head-to-head history is unavailable."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadInjuries(eventId: number) {
  const ctx = new RequestContext("Match Centre", "injuries");
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.eventInjuries(eventId, { screen: "Match Centre", component: "injuries" });
  const home = asArray(result.body?.home);
  const away = asArray(result.body?.away);
  const items = [...home, ...away, ...unwrapList(result.body)];
  let availability: "AVAILABLE" | "EMPTY" | "UNAVAILABLE" | "FAILED" = "UNAVAILABLE";
  if (result.status >= 400) availability = result.status === 404 ? "UNAVAILABLE" : "FAILED";
  else if (items.length) availability = "AVAILABLE";
  else if (result.status === 200) availability = "EMPTY";
  if (result.status === 200 && items.length === 0) {
    ctx.recordGap({
      code: "INJURIES_EMPTY_OR_UNSUPPORTED",
      type: "DOCUMENTATION_GAP",
      severity: "P2",
      endpoint: `/event/${eventId}/injuries`,
      expected: "documented meaning of empty injuries (none vs unsupported)",
      actual: "200 empty",
      userImpact: "Cannot tell 'no injuries' from 'injuries not covered'.",
      developerImpact: "UI must not render empty as no injuries.",
    });
  }
  return {
    items,
    availability,
    widget: widgetFromResult(result, "Injury information is unavailable — this is not the same as no injuries."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export async function loadEnrichments(eventId: number, type?: string) {
  const ctx = new RequestContext("Match Centre", "enrichments");
  const client = new FootballClient(withClient(ctx).onCall);
  const catalogue = await client.eventEnrichments(eventId, { screen: "Match Centre", component: "enrichments" });
  const types = asArray(catalogue.body?.types)
    .map((item) => {
      const rec = asRecord(item);
      return typeof item === "string" ? item : String(rec?.type || rec?.name || "");
    })
    .filter(Boolean);
  if (!types.length) {
    ctx.recordGap({
      code: "EVENT_ENRICHMENTS_EMPTY",
      type: "EMPTY_RESPONSE",
      severity: "P3",
      endpoint: `/event/${eventId}/enrichments`,
      expected: "documented enrichment types",
      actual: "types = []",
      userImpact: "No extra datasets behind enrichments.",
      developerImpact: "Do not assume odds, news, or predictions exist here.",
    });
  }
  let selected = null;
  const pick = type || types[0];
  if (pick) {
    const typed = await client.eventEnrichmentType(eventId, pick, {
      screen: "Match Centre",
      component: `enrichment:${pick}`,
    });
    selected = { type: pick, ...widgetFromResult(typed, `Enrichment '${pick}' is unavailable.`), raw: typed.body, status: typed.status };
  }
  return {
    types,
    selected,
    widget: widgetFromResult(catalogue, "No enrichments are published for this match."),
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export { isOptionalEnrichment404 };
