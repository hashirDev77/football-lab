import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FootballClient } from "../raw/client.js";
import { config } from "../config.js";
import { asArray, asRecord, unwrapEntity, unwrapEvent, unwrapList, unwrapPlayer, unwrapTeam, unwrapTournament } from "../raw/unwrap.js";
import type { Json, ProviderResult } from "../raw/types.js";

type Verdict = "Works" | "Partial" | "Empty" | "Not available" | "Expected" | "Fail";

interface Row {
  path: string;
  family: string;
  http: number;
  ms: number;
  bytes: number;
  dataType: string;
  shape: string;
  pagination: string;
  quality: string;
  missing: string[];
  verdict: Verdict;
  notes: string;
  error?: string;
}

function idOf(value: unknown): number | undefined {
  const rec = asRecord(value);
  const n = Number(rec?.id ?? rec?.player?.id ?? rec?.team?.id ?? rec?.event?.id ?? rec?.uniqueTournament?.id ?? value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function listMeta(body: Json | null) {
  if (!body) return null;
  const keys = ["items", "events", "players", "seasons", "media", "rankings", "incidents", "uniqueTournaments", "uniqueTournamentSeasons", "standings", "types"];
  const listKey = keys.find((k) => Array.isArray(body[k]));
  const list = listKey ? asArray(body[listKey]) : [];
  return {
    listKey: listKey || null,
    count: list.length,
    page: body.page,
    limit: body.limit,
    total: body.total,
    totalPages: body.totalPages,
    hasMore: body.hasMore,
  };
}

function present(obj: Json | null | undefined, fields: string[]): string[] {
  if (!obj) return fields;
  return fields.filter((f) => {
    const v = obj[f];
    if (v == null || v === "") return true;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) return true;
    return false;
  });
}

function firstRow(body: Json | null): Json | null {
  const list = unwrapList(body);
  return asRecord(list[0]) || asRecord(unwrapEvent(body)) || asRecord(unwrapTeam(body)) || asRecord(unwrapPlayer(body));
}

function classifyDataType(path: string, result: ProviderResult): string {
  if (result.status === 400) return "Validation error";
  if (result.status === 404) {
    const msg = String(result.error || result.body?.message || "").toLowerCase();
    if (msg.includes("enrichment") || msg.includes("no season statistics") || msg.includes("statistics for player")) {
      return "Optional extra (404)";
    }
    return "Not found";
  }
  if (result.status !== 200) return "HTTP error";
  const body = result.body;
  if (!body) return "Empty";
  const meta = listMeta(body);
  if (meta?.listKey && meta.count === 0 && result.bytes < 120) return "Empty paginated list";
  if (meta?.listKey) return `Paginated list (${meta.listKey})`;
  if (body.event) return "Match object";
  if (body.player && body.statistics) return "Season statistics object";
  if (body.player) return "Player object";
  if (body.team && body.statistics) return "Season statistics object";
  if (body.team) return "Team object";
  if (body.uniqueTournament) return "Competition object";
  if (body.manager) return "Manager object";
  if (body.home && body.away) return "Home/away envelope";
  if (body.homeTeam || body.awayTeam) return "Home/away envelope";
  if (body.teamDuel || body.managerDuel) return "Head-to-head object";
  if (body.previousEvent || body.nextEvent) return "Previous/next match object";
  if (body.statistics) return "Match statistics object";
  if (body.types) return "Enrichment type list";
  if (body.conditions != null) return "Weather object";
  if (body.standings) return "Standings table";
  return `Object (${Object.keys(body).slice(0, 6).join(", ")})`;
}

function paginationNote(path: string, result: ProviderResult, extra?: string): string {
  const meta = listMeta(result.body);
  if (extra) return extra;
  if (!meta?.listKey) return "Not a list";
  const bits = [`key=${meta.listKey}`, `page=${meta.page ?? "—"}`, `limit=${meta.limit ?? "—"}`, `total=${meta.total ?? "—"}`, `hasMore=${String(meta.hasMore)}`];
  return bits.join(", ");
}

function emptyish(result: ProviderResult): boolean {
  if (result.status !== 200) return false;
  if (result.bytes < 90) return true;
  const meta = listMeta(result.body);
  if (meta?.listKey && meta.count === 0) return true;
  const body = result.body;
  if (!body) return true;
  if (body.home && body.away) {
    const home = asRecord(body.home);
    const away = asRecord(body.away);
    const homePlayers = asArray(home?.players).length + asArray(home?.injuries).length + asArray(home?.lineup).length;
    const awayPlayers = asArray(away?.players).length + asArray(away?.injuries).length + asArray(away?.lineup).length;
    if (homePlayers + awayPlayers === 0 && result.bytes < 200) return true;
  }
  return false;
}

function verdictFor(path: string, result: ProviderResult, missing: string[]): Verdict {
  if (result.status === 400) return "Expected";
  if (result.status === 404) {
    const msg = String(result.error || "").toLowerCase();
    if (msg.includes("enrichment") || msg.includes("no season statistics") || msg.includes("statistics for player") || msg.includes("manager")) {
      return "Not available";
    }
    return "Expected";
  }
  if (result.status !== 200) return "Fail";
  if (emptyish(result)) return "Empty";
  if (missing.length > 0) return "Partial";
  return "Works";
}

function inspectMissing(path: string, result: ProviderResult): string[] {
  if (result.status !== 200 || !result.body) return [];
  const body = result.body;
  const row = firstRow(body);
  const event = unwrapEvent(body) || asRecord(body.previousEvent) || asRecord(body.nextEvent) || asRecord(body.event);
  const player = unwrapPlayer(body);
  const team = unwrapTeam(body);
  const tournament = unwrapTournament(body);

  if (path.includes("/fixtures/today") || path === "/events" || path.endsWith("/events") || path.includes("/events/")) {
    const sample = event || row;
    return present(sample, ["id", "homeTeam", "awayTeam", "status", "startTimestamp", "homeScore", "awayScore"]);
  }
  if (path === `/event/${String(event?.id || "")}` || path.match(/^\/event\/\d+$/)) {
    return present(event, ["id", "homeTeam", "awayTeam", "status", "startTimestamp", "homeScore", "awayScore", "uniqueTournament", "venue"]);
  }
  if (path.includes("/lineups")) {
    const home = asRecord(body.home);
    const away = asRecord(body.away);
    const miss: string[] = [];
    if (asArray(home?.players).length < 11 && asArray(home?.lineup).length < 11) miss.push("starting XI");
    if (!home?.formation && !away?.formation) miss.push("formation");
    if (!idOf(home?.manager || home?.coach || away?.manager)) miss.push("manager id");
    return miss;
  }
  if (path.includes("/incidents")) {
    const first = asRecord(unwrapList(body)[0]);
    return present(first, ["type", "time", "player", "team"]);
  }
  if (path.includes("/injuries")) {
    const home = asArray(asRecord(body.home)?.players || asRecord(body.home)?.injuries);
    if (home.length === 0 && asArray(body.home).length === 0) return ["injury coverage / items"];
    return [];
  }
  if (path.includes("/player") && path.includes("/statistics") && !path.includes("player-statistics")) {
    return present(asRecord(body.statistics) || body, ["statistics"]);
  }
  if (path.includes("player-statistics")) {
    if (unwrapList(body).length === 0) return ["per-player match stats"];
    return [];
  }
  if (path.includes("/h2h")) {
    const duel = asRecord(body.teamDuel);
    if (!duel || Object.keys(duel).length === 0) return ["previous meetings / event ids"];
    return present(duel, ["wins", "draws"]);
  }
  if (path.includes("/pregame-form")) {
    if (!asRecord(body.homeTeam) && !asRecord(body.awayTeam)) return ["recent form rows"];
    const ht = asRecord(body.homeTeam);
    if (ht && Object.values(ht).every((v) => v == null || v === "")) return ["recent form rows"];
    return [];
  }
  if (path.includes("/weather")) {
    if (body.conditions == null || body.conditions === "") return ["conditions"];
    return [];
  }
  if (path.includes("/search")) {
    return present(row, ["id", "name", "type"]);
  }
  if (path.match(/^\/player\/\d+$/) || (player && path.includes("/player/") && !path.includes("events") && !path.includes("statistics"))) {
    return present(player, ["name", "team", "position", "country", "dateOfBirth", "height", "jerseyNumber"]);
  }
  if (path.match(/^\/team\/\d+$/) || (team && path.includes("/team/") && path.split("/").length <= 3)) {
    return present(team, ["name", "country", "logo"]);
  }
  if (path.includes("/players") && path.includes("/team/")) {
    const first = asRecord(unwrapList(body)[0]);
    return present(first, ["id", "name", "position"]);
  }
  if (path.includes("unique-tournament") && path.split("/").length <= 3) {
    return present(tournament, ["name", "category", "currentSeasonId"]);
  }
  if (path.includes("/standings/")) {
    const groups = asArray(body.standings);
    const firstGroup = asRecord(groups[0]);
    const firstStanding = asRecord(asArray(firstGroup?.rows)[0]);
    if (!firstStanding) return ["table rows"];
    return present(firstStanding, ["position", "team", "points", "scoresFor", "scoresAgainst", "scoreDiffFormatted"]);
  }
  if (path.includes("/rankings")) {
    const first = asRecord(unwrapList(body)[0]);
    return present(first, ["ranking", "team"]);
  }
  return [];
}

function row(path: string, family: string, result: ProviderResult, extras?: Partial<Row>): Row {
  const missing = extras?.missing ?? inspectMissing(path, result);
  const v = extras?.verdict ?? verdictFor(path, result, missing);
  return {
    path,
    family,
    http: result.status,
    ms: result.ms,
    bytes: result.bytes,
    dataType: extras?.dataType ?? classifyDataType(path, result),
    shape: extras?.shape ?? (result.body ? Object.keys(result.body).join(", ") : "—"),
    pagination: extras?.pagination ?? paginationNote(path, result),
    quality: extras?.quality ?? (v === "Works" ? "Usable" : v === "Partial" ? "Usable with gaps" : v === "Empty" ? "Empty 200" : v === "Not available" ? "Optional extra missing" : v),
    missing,
    verdict: v,
    notes: extras?.notes ?? "",
    error: result.error,
  };
}

async function main() {
  const client = new FootballClient();
  const rows: Row[] = [];
  const extras: Record<string, unknown> = {};

  const searchArsenal = await client.search("Arsenal", 1, 5);
  const searchPL = await client.search("Premier League", 1, 5);
  const searchSalah = await client.search("Salah", 1, 5);
  const searchMissingQ = await client.search("", 1, 5);
  const searchNoParam = await client.get("search", { page: 1, limit: 5 });
  const searchPage2 = await client.search("a", 1, 5);
  const searchPage2b = await client.search("a", 2, 5);
  const searchHuge = await client.search("Arsenal", 9999, 5);

  rows.push(row("/search", "lists", searchArsenal, { notes: "Club query returns typed hits.", quality: searchArsenal.status === 200 && unwrapList(searchArsenal.body).length ? "Usable" : "Weak" }));
  rows.push(row("/search (missing q)", "lists", searchNoParam, { verdict: searchNoParam.status === 400 ? "Expected" : searchNoParam.status === 200 ? "Partial" : "Fail", notes: "Search without q.", pagination: "N/A", dataType: classifyDataType("/search", searchNoParam) }));
  rows.push(row("/search (page 2)", "lists", searchPage2b, { notes: "Second page of a broad query.", pagination: paginationNote("/search", searchPage2b, `page1 count=${unwrapList(searchPage2.body).length}; page2 count=${unwrapList(searchPage2b.body).length}; first ids differ=${idOf(unwrapList(searchPage2.body)[0]) !== idOf(unwrapList(searchPage2b.body)[0])}`) }));
  rows.push(row("/search (huge page)", "lists", searchHuge, { notes: "Out-of-range page should be empty 200, not 404.", verdict: searchHuge.status === 200 ? (unwrapList(searchHuge.body).length ? "Partial" : "Empty") : searchHuge.status === 404 ? "Fail" : "Expected" }));

  const teamId = idOf(unwrapList(searchArsenal.body)[0]) || idOf(asRecord(unwrapList((await client.teams(1, 1)).body)[0]));
  const playerId = idOf(unwrapList(searchSalah.body)[0]);
  const tournamentId = idOf(unwrapList(searchPL.body)[0]);

  extras.discovered = { teamId, playerId, tournamentId };

  const fixturesP1 = await client.fixturesToday(1, 5);
  const fixturesP2 = await client.fixturesToday(2, 5);
  rows.push(row("/fixtures/today", "lists", fixturesP1, { notes: "Today’s match list." }));
  rows.push(row("/fixtures/today (page 2)", "lists", fixturesP2, { notes: "Paging today’s list.", pagination: paginationNote("/fixtures/today", fixturesP2, `page1=${unwrapList(fixturesP1.body).length} page2=${unwrapList(fixturesP2.body).length} overlap=${idOf(unwrapList(fixturesP1.body)[0]) === idOf(unwrapList(fixturesP2.body)[0])}`) }));

  const eventsDefault = await client.events({ page: 1, limit: 5 });
  const eventsP2 = await client.events({ page: 2, limit: 5 });
  const eventsLive = await client.events({ status: "inprogress", page: 1, limit: 5 });
  const eventsFinished = await client.events({ status: "finished", page: 1, limit: 5 });
  const eventsNotStarted = await client.events({ status: "notstarted", page: 1, limit: 5 });
  const eventsHuge = await client.events({ page: 9999, limit: 5 });
  rows.push(row("/events", "lists", eventsDefault, { notes: "Default match feed." }));
  rows.push(row("/events (page 2)", "lists", eventsP2, { notes: "Confirm page 2 is a new slice.", pagination: paginationNote("/events", eventsP2, `page1 first=${idOf(unwrapList(eventsDefault.body)[0])} page2 first=${idOf(unwrapList(eventsP2.body)[0])} different=${idOf(unwrapList(eventsDefault.body)[0]) !== idOf(unwrapList(eventsP2.body)[0])}`) }));
  rows.push(row("/events?status=inprogress", "lists", eventsLive, { notes: "Live filter." }));
  rows.push(row("/events?status=finished", "lists", eventsFinished, { notes: "Finished filter." }));
  rows.push(row("/events?status=notstarted", "lists", eventsNotStarted, { notes: "Upcoming filter." }));
  rows.push(row("/events (huge page)", "lists", eventsHuge, { notes: "Out-of-range page.", verdict: eventsHuge.status === 200 ? (unwrapList(eventsHuge.body).length ? "Partial" : "Empty") : "Fail" }));

  const teamsP1 = await client.teams(1, 5);
  const teamsP2 = await client.teams(2, 5);
  const playersP1 = await client.players(1, 5);
  const playersP2 = await client.players(2, 5);
  const tournamentsP1 = await client.tournaments(1, 5);
  const tournamentsP2 = await client.tournaments(2, 5);
  rows.push(row("/teams", "lists", teamsP1, { notes: "Team directory." }));
  rows.push(row("/teams (page 2)", "lists", teamsP2, { notes: "Directory paging.", pagination: paginationNote("/teams", teamsP2, `different=${idOf(unwrapList(teamsP1.body)[0]) !== idOf(unwrapList(teamsP2.body)[0])}`) }));
  rows.push(row("/players", "lists", playersP1, { notes: "Player directory." }));
  rows.push(row("/players (page 2)", "lists", playersP2, { notes: "Directory paging.", pagination: paginationNote("/players", playersP2, `different=${idOf(unwrapList(playersP1.body)[0]) !== idOf(unwrapList(playersP2.body)[0])}`) }));
  rows.push(row("/tournaments", "lists", tournamentsP1, { notes: "Competition directory." }));
  rows.push(row("/tournaments (page 2)", "lists", tournamentsP2, { notes: "Directory paging.", pagination: paginationNote("/tournaments", tournamentsP2, `different=${idOf(unwrapList(tournamentsP1.body)[0]) !== idOf(unwrapList(tournamentsP2.body)[0])}`) }));

  const candidateIds: number[] = [];
  for (const src of [fixturesP1, eventsLive, eventsFinished, eventsDefault]) {
    for (const item of unwrapList(src.body)) {
      const id = idOf(item);
      if (id && !candidateIds.includes(id)) candidateIds.push(id);
    }
  }

  let bestEventId = candidateIds[0];
  let bestEventBytes = 0;
  let bestLineups: ProviderResult | null = null;
  let bestIncidents: ProviderResult | null = null;
  const probes: Record<string, { id: number; lineups: number; incidents: number; stats: number }> = {};
  for (const id of candidateIds.slice(0, 6)) {
    const [lineups, incidents, stats] = await Promise.all([
      client.eventLineups(id),
      client.eventIncidents(id),
      client.eventStatistics(id),
    ]);
    probes[String(id)] = { id, lineups: lineups.bytes, incidents: incidents.bytes, stats: stats.bytes };
    const score = lineups.bytes + incidents.bytes + stats.bytes;
    if (score > bestEventBytes) {
      bestEventBytes = score;
      bestEventId = id;
      bestLineups = lineups;
      bestIncidents = incidents;
    }
  }

  extras.eventProbes = probes;
  extras.eventId = bestEventId;

  const badEvent = await client.event("abc" as unknown as number);
  rows.push(row("/event/abc", "match", badEvent, { verdict: badEvent.status === 400 ? "Expected" : "Fail", notes: "Non-numeric match id.", pagination: "Not a list", missing: [] }));

  const unknownEvent = await client.event(999999999);
  rows.push(row("/event/{unknown}", "match", unknownEvent, { verdict: unknownEvent.status === 404 ? "Expected" : "Fail", notes: "Unknown match id.", pagination: "Not a list", missing: [] }));

  if (bestEventId) {
    const event = await client.event(bestEventId);
    const eventObj = unwrapEvent(event.body);
    const tournamentFromEvent = idOf(asRecord(eventObj?.uniqueTournament) || asRecord(asRecord(eventObj?.tournament)?.uniqueTournament));
    extras.eventTournamentId = tournamentFromEvent ?? null;
    extras.eventStatus = eventObj?.status ?? null;
    extras.eventHasScore = Boolean(eventObj?.homeScore || eventObj?.awayScore);
    extras.eventUniqueTournamentId = idOf(asRecord(eventObj?.uniqueTournament));

    rows.push(row("/event/{eventId}", "match", event, { notes: "Match header / detail." }));

    const bestPlayers = await client.eventBestPlayers(bestEventId);
    const enrichments = await client.eventEnrichments(bestEventId);
    const enrichmentTypes = unwrapList(enrichments.body)
      .map((item) => (typeof item === "string" ? item : String(asRecord(item)?.type || asRecord(item)?.name || "")))
      .filter(Boolean);
    extras.eventEnrichmentTypes = enrichmentTypes;
    const enrichmentType = await client.eventEnrichmentType(bestEventId, enrichmentTypes[0] || "best_players");
    const h2h = await client.eventH2h(bestEventId);
    const injuries = await client.eventInjuries(bestEventId);
    const playerStats = await client.eventPlayerStatistics(bestEventId);
    const pregame = await client.eventPregameForm(bestEventId);
    const statistics = await client.eventStatistics(bestEventId);
    const streaks = await client.eventTeamStreaks(bestEventId);
    const weather = await client.eventWeather(bestEventId);
    const lineups = bestLineups || (await client.eventLineups(bestEventId));
    const incidents = bestIncidents || (await client.eventIncidents(bestEventId));

    rows.push(row("/event/{eventId}/best-players", "match", bestPlayers, { notes: "Match extras / MOTM-style ranking." }));
    rows.push(row("/event/{eventId}/enrichments", "match", enrichments, { notes: "Index of extras on a match." }));
    rows.push(row("/event/{eventId}/enrichments/{type}", "match", enrichmentType, { notes: "Typed match extra." }));
    rows.push(row("/event/{eventId}/h2h", "match", h2h, { notes: "Head to head." }));
    rows.push(row("/event/{eventId}/incidents", "match", incidents, { notes: "Match timeline." }));
    rows.push(row("/event/{eventId}/injuries", "match", injuries, { notes: "Match injury list." }));
    rows.push(row("/event/{eventId}/lineups", "match", lineups, { notes: "Starting XI and bench." }));
    rows.push(row("/event/{eventId}/player-statistics", "match", playerStats, { notes: "All players’ match stats." }));
    rows.push(row("/event/{eventId}/pregame-form", "match", pregame, { notes: "Recent form before kickoff." }));
    rows.push(row("/event/{eventId}/statistics", "match", statistics, { notes: "Team match statistics." }));
    rows.push(row("/event/{eventId}/team-streaks", "match", streaks, { notes: "Win/loss streak extra." }));
    rows.push(row("/event/{eventId}/weather", "match", weather, { notes: "Match weather." }));

    let lineupPlayerId: number | undefined;
    const home = asRecord(lineups.body?.home);
    const away = asRecord(lineups.body?.away);
    for (const bucket of [home, away]) {
      for (const p of [...asArray(bucket?.players), ...asArray(bucket?.lineup), ...asArray(asRecord(bucket?.players)?.starters)]) {
        const pid = idOf(p) || idOf(asRecord(p)?.player);
        if (pid) {
          lineupPlayerId = pid;
          break;
        }
      }
      if (lineupPlayerId) break;
    }
    const statsPlayerId = idOf(unwrapList(playerStats.body)[0]) || lineupPlayerId || playerId;
    if (statsPlayerId) {
      const byId = await client.eventPlayerStatisticsById(bestEventId, statsPlayerId);
      rows.push(row("/event/{eventId}/player/{playerId}/statistics", "match", byId, { notes: "One player’s stats for this match." }));
    } else if (playerId) {
      const byId = await client.eventPlayerStatisticsById(bestEventId, playerId);
      rows.push(row("/event/{eventId}/player/{playerId}/statistics", "match", byId, { notes: "Player not necessarily in this match." }));
    }

    const managerId =
      idOf(asRecord(eventObj?.homeTeam)?.manager) ||
      idOf(asRecord(eventObj?.awayTeam)?.manager) ||
      idOf(home?.manager) ||
      idOf(away?.manager) ||
      idOf(home?.coach) ||
      idOf(away?.coach);
    extras.managerId = managerId ?? null;
    if (managerId) {
      const manager = await client.manager(managerId);
      rows.push(row("/manager/{managerId}", "manager", manager, { notes: "Manager profile from a real id on the match." }));
    } else {
      const manager = await client.manager(2);
      rows.push(row("/manager/{managerId}", "manager", manager, { notes: "No manager id on match/lineup; probed a placeholder id." }));
    }
  }

  const unknownPlayer = await client.player(999999999);
  rows.push(row("/player/{unknown}", "player", unknownPlayer, { verdict: unknownPlayer.status === 404 ? "Expected" : "Fail", notes: "Unknown player id.", pagination: "Not a list", missing: [] }));

  if (playerId) {
    const player = await client.player(playerId);
    rows.push(row("/player/{playerId}", "player", player, { notes: "Player profile." }));
    const lastP1 = await client.playerEvents(playerId, "last", 1, 5);
    const lastP2 = await client.playerEvents(playerId, "last", 2, 5);
    const next = await client.playerEvents(playerId, "next", 1, 5);
    const badDir = await client.get(`player/${playerId}/events/sideways`);
    rows.push(row("/player/{playerId}/events/last", "player", lastP1, { notes: "Recent matches." }));
    rows.push(row("/player/{playerId}/events/last (page 2)", "player", lastP2, { notes: "Paging player matches.", pagination: paginationNote("/player/events", lastP2, `different=${idOf(unwrapList(lastP1.body)[0]) !== idOf(unwrapList(lastP2.body)[0])}`) }));
    rows.push(row("/player/{playerId}/events/next", "player", next, { notes: "Upcoming matches." }));
    rows.push(row("/player/{playerId}/events/{invalid}", "player", badDir, { verdict: badDir.status === 400 || badDir.status === 404 ? "Expected" : "Fail", notes: "Invalid direction.", pagination: "N/A", missing: [] }));
  }

  if (teamId) {
    const team = await client.team(teamId);
    rows.push(row("/team/{teamId}", "team", team, { notes: "Team profile." }));
    const squad = await client.teamPlayers(teamId);
    rows.push(row("/team/{teamId}/players", "team", squad, { notes: "Squad list." }));
    const last = await client.teamEvents(teamId, "last", 1, 5);
    const last2 = await client.teamEvents(teamId, "last", 2, 5);
    const next = await client.teamEvents(teamId, "next", 1, 5);
    rows.push(row("/team/{teamId}/events/last", "team", last, { notes: "Recent team matches." }));
    rows.push(row("/team/{teamId}/events/last (page 2)", "team", last2, { notes: "Paging team matches.", pagination: paginationNote("/team/events", last2, `different=${idOf(unwrapList(last.body)[0]) !== idOf(unwrapList(last2.body)[0])}`) }));
    rows.push(row("/team/{teamId}/events/next", "team", next, { notes: "Upcoming team matches." }));
    const featured = await client.teamFeaturedEvent(teamId);
    rows.push(row("/team/{teamId}/featured-event", "team", featured, { notes: "Featured match. Meaning is editorial, not ‘currently live’." }));
    const near = await client.teamNearEvents(teamId);
    rows.push(row("/team/{teamId}/near-events", "team", near, { notes: "Previous and next match." }));
    const performance = await client.teamPerformance(teamId);
    rows.push(row("/team/{teamId}/performance", "team", performance, { notes: "Form / points window." }));
    const rankings = await client.teamRankings(teamId, 1, 5);
    rows.push(row("/team/{teamId}/rankings", "team", rankings, { notes: "Team ranking rows." }));
    const teamTours = await client.teamUniqueTournaments(teamId, 1, 8);
    rows.push(row("/team/{teamId}/unique-tournaments", "team", teamTours, { notes: "Competitions the team plays." }));
    const standingsSeasons = await client.teamStandingsSeasons(teamId, 1, 8);
    rows.push(row("/team/{teamId}/standings-seasons", "team", standingsSeasons, { notes: "Seasons with a table." }));
    const media = await client.teamMedia(teamId, 1, 5);
    const media2 = await client.teamMedia(teamId, 2, 5);
    rows.push(row("/team/{teamId}/media", "team", media, { notes: "Crest / images." }));
    rows.push(row("/team/{teamId}/media (page 2)", "team", media2, { notes: "Paging media.", pagination: paginationNote("/team/media", media2, `count=${unwrapList(media2.body).length}`) }));
    const teamEnr = await client.teamEnrichments(teamId);
    rows.push(row("/team/{teamId}/enrichments", "team", teamEnr, { notes: "Index of team extras." }));
    const types = unwrapList(teamEnr.body).map((item) => (typeof item === "string" ? item : String(asRecord(item)?.type || asRecord(item)?.name || ""))).filter(Boolean);
    extras.teamEnrichmentTypes = types;
    const typed = await client.teamEnrichmentType(teamId, types[0] || "events_last");
    rows.push(row("/team/{teamId}/enrichments/{type}", "team", typed, { notes: "Typed team extra." }));

    const teamTournamentId = idOf(unwrapList(teamTours.body)[0]) || tournamentId;
    let teamSeasonId: number | undefined;
    if (teamTournamentId) {
      const seasonsForTeam = await client.uniqueTournamentSeasons(teamTournamentId, 1, 5);
      teamSeasonId = idOf(unwrapList(seasonsForTeam.body)[0]);
    }
    extras.teamStatsIds = { teamId, teamTournamentId, teamSeasonId };
    if (teamTournamentId && teamSeasonId) {
      const teamStats = await client.teamSeasonStatistics(teamId, teamTournamentId, teamSeasonId);
      rows.push(row("/team/{teamId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics", "team", teamStats, { notes: "Team season stats using a competition the team actually lists." }));
    }

    if (playerId && teamTournamentId && teamSeasonId) {
      const pStats = await client.playerSeasonStatistics(playerId, teamTournamentId, teamSeasonId);
      rows.push(row("/player/{playerId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics", "player", pStats, { notes: "Player season stats against a linked competition/season." }));
    }
  }

  const unknownTeam = await client.team(999999999);
  rows.push(row("/team/{unknown}", "team", unknownTeam, { verdict: unknownTeam.status === 404 ? "Expected" : "Fail", notes: "Unknown team id.", pagination: "Not a list", missing: [] }));

  if (tournamentId) {
    const ut = await client.uniqueTournament(tournamentId);
    rows.push(row("/unique-tournament/{tournamentId}", "competition", ut, { notes: "Competition profile." }));
    const te1 = await client.uniqueTournamentEvents(tournamentId, 1, 5);
    const te2 = await client.uniqueTournamentEvents(tournamentId, 2, 5);
    rows.push(row("/unique-tournament/{tournamentId}/events", "competition", te1, { notes: "Competition match list." }));
    rows.push(row("/unique-tournament/{tournamentId}/events (page 2)", "competition", te2, { notes: "Paging competition matches.", pagination: paginationNote("/unique-tournament/events", te2, `different=${idOf(unwrapList(te1.body)[0]) !== idOf(unwrapList(te2.body)[0])}`) }));

    const today = new Date().toISOString().slice(0, 10);
    const scheduled = await client.uniqueTournamentScheduled(tournamentId, today);
    const badDate = await client.uniqueTournamentScheduled(tournamentId, "not-a-date");
    rows.push(row("/unique-tournament/{tournamentId}/scheduled-events/{date}", "competition", scheduled, { notes: "Calendar day for a competition." }));
    rows.push(row("/unique-tournament/{tournamentId}/scheduled-events/{invalid}", "competition", badDate, { verdict: badDate.status === 400 ? "Expected" : badDate.status === 200 ? "Partial" : "Fail", notes: "Invalid date format.", pagination: "N/A", missing: [] }));

    const seasons = await client.uniqueTournamentSeasons(tournamentId, 1, 5);
    const seasons2 = await client.uniqueTournamentSeasons(tournamentId, 2, 5);
    rows.push(row("/unique-tournament/{tournamentId}/seasons", "competition", seasons, { notes: "Season list." }));
    rows.push(row("/unique-tournament/{tournamentId}/seasons (page 2)", "competition", seasons2, { notes: "Paging seasons.", pagination: paginationNote("/seasons", seasons2, `different=${idOf(unwrapList(seasons.body)[0]) !== idOf(unwrapList(seasons2.body)[0])}`) }));
    const seasonId = idOf(unwrapList(seasons.body)[0]);
    extras.seasonId = seasonId ?? null;
    if (seasonId) {
      const total = await client.uniqueTournamentStandings(tournamentId, seasonId, "total");
      const home = await client.uniqueTournamentStandings(tournamentId, seasonId, "home");
      const away = await client.uniqueTournamentStandings(tournamentId, seasonId, "away");
      const round = await client.uniqueTournamentRound(tournamentId, seasonId, 1);
      const badType = await client.get(`unique-tournament/${tournamentId}/season/${seasonId}/standings/form`);
      rows.push(row("/unique-tournament/{tournamentId}/season/{seasonId}/standings/total", "competition", total, { notes: "League table." }));
      rows.push(row("/unique-tournament/{tournamentId}/season/{seasonId}/standings/home", "competition", home, { notes: "Home table." }));
      rows.push(row("/unique-tournament/{tournamentId}/season/{seasonId}/standings/away", "competition", away, { notes: "Away table." }));
      rows.push(row("/unique-tournament/{tournamentId}/season/{seasonId}/standings/{invalid}", "competition", badType, { verdict: badType.status === 400 || badType.status === 404 ? "Expected" : "Partial", notes: "Invalid standings type.", pagination: "N/A", missing: [] }));
      rows.push(row("/unique-tournament/{tournamentId}/season/{seasonId}/round/{round}", "competition", round, { notes: "Matchday / round list." }));
    }
  }

  const catalogPaths = [
    "/event/{eventId}",
    "/event/{eventId}/best-players",
    "/event/{eventId}/enrichments",
    "/event/{eventId}/enrichments/{type}",
    "/event/{eventId}/h2h",
    "/event/{eventId}/incidents",
    "/event/{eventId}/injuries",
    "/event/{eventId}/lineups",
    "/event/{eventId}/player-statistics",
    "/event/{eventId}/player/{playerId}/statistics",
    "/event/{eventId}/pregame-form",
    "/event/{eventId}/statistics",
    "/event/{eventId}/team-streaks",
    "/event/{eventId}/weather",
    "/events",
    "/fixtures/today",
    "/manager/{managerId}",
    "/player/{playerId}",
    "/player/{playerId}/events/{direction}",
    "/player/{playerId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics",
    "/players",
    "/search",
    "/team/{teamId}",
    "/team/{teamId}/enrichments",
    "/team/{teamId}/enrichments/{type}",
    "/team/{teamId}/events/{direction}",
    "/team/{teamId}/featured-event",
    "/team/{teamId}/media",
    "/team/{teamId}/near-events",
    "/team/{teamId}/performance",
    "/team/{teamId}/players",
    "/team/{teamId}/rankings",
    "/team/{teamId}/standings-seasons",
    "/team/{teamId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics",
    "/team/{teamId}/unique-tournaments",
    "/teams",
    "/tournaments",
    "/unique-tournament/{tournamentId}",
    "/unique-tournament/{tournamentId}/events",
    "/unique-tournament/{tournamentId}/scheduled-events/{date}",
    "/unique-tournament/{tournamentId}/season/{seasonId}/round/{round}",
    "/unique-tournament/{tournamentId}/season/{seasonId}/standings/{type}",
    "/unique-tournament/{tournamentId}/seasons",
  ];

  const covered = catalogPaths.filter((p) =>
    rows.some((r) => {
      const base = r.path.replace(/ \(.*\)$/, "");
      if (p === "/player/{playerId}/events/{direction}") return base.startsWith("/player/") && base.includes("/events/");
      if (p === "/team/{teamId}/events/{direction}") return base.startsWith("/team/") && base.includes("/events/");
      if (p === "/unique-tournament/{tournamentId}/season/{seasonId}/standings/{type}") return r.path.includes("/standings/");
      if (p === "/event/{eventId}/enrichments/{type}") return r.path.includes("/enrichments/{type}") || r.path.includes("/enrichments/");
      return base === p || r.path.startsWith(p.replace(/\{[^}]+\}/g, "")) || r.path === p;
    }),
  );

  const report = {
    extras,
    missingQ: { status: searchMissingQ.status, error: searchMissingQ.error, bytes: searchMissingQ.bytes, keys: searchMissingQ.body ? Object.keys(searchMissingQ.body) : [] },
    searchNoParam: { status: searchNoParam.status, error: searchNoParam.error, bytes: searchNoParam.bytes },
    rowCount: rows.length,
    catalog: catalogPaths.length,
    catalogCovered: covered.length,
    uncovered: catalogPaths.filter((p) => !covered.includes(p)),
    rows,
  };

  mkdirSync(config.dataDir, { recursive: true });
  const out = join(config.dataDir, "full-catalog-test.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, rowCount: rows.length, catalogCovered: covered.length, uncovered: report.uncovered, extras }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
