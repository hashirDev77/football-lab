import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FootballClient } from "../raw/client.js";
import { config } from "../config.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import { asRecord, unwrapList } from "../raw/unwrap.js";
import { TEAM_ENRICHMENT_TYPES } from "../raw/types.js";
import { CATALOG } from "../raw/catalog.js";
import { catalogTotals, coverageByScreen, endpointHealth, experienceScores } from "../gaps/scoring.js";
import { recommendationsFromGaps } from "../gaps/recommendations.js";
import { writeMarkdownReport } from "./writeReport.js";

function idOf(value: unknown): number | undefined {
  const rec = asRecord(value);
  const n = Number(rec?.id ?? value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const ctx = new RequestContext("Phase1 audit", "catalog sweep");
  const client = new FootballClient(withClient(ctx).onCall);

  const auth = {
    apimOnly: await client.get("fixtures/today", undefined, { screen: "Phase1 audit", component: "auth" }, { apim: true, live: false }),
    liveOnly: await client.get("fixtures/today", undefined, { screen: "Phase1 audit", component: "auth" }, { apim: false, live: true }),
    both: await client.get("fixtures/today", undefined, { screen: "Phase1 audit", component: "auth" }, { apim: true, live: true }),
  };
  if (auth.apimOnly.status === 403 && (auth.liveOnly.status === 200 || auth.both.status === 200)) {
    ctx.recordGap({
      code: "AUTHENTICATION_GAP",
      type: "AUTHENTICATION_GAP",
      severity: "P0",
      endpoint: "/fixtures/today",
      expected: "documented auth contract (both keys, or one published key)",
      actual: `APIM-only=${auth.apimOnly.status} live-only=${auth.liveOnly.status} both=${auth.both.status}`,
      userImpact: "Integration cannot start from the written docs.",
      developerImpact: "Clients guess which header is required.",
      recommendation: "Publish one Football auth contract.",
    });
  }

  const fixtures = await client.fixturesToday(undefined, undefined, { screen: "Phase1 audit", component: "live ids" });
  const fixtureRow = asRecord(unwrapList(fixtures.body)[0]);
  const eventId = idOf(fixtureRow) || idOf(asRecord(fixtureRow?.event));

  const searches: Record<string, number | undefined> = {};
  for (const q of ["Arsenal", "Premier League", "Salah", "Champions", "Liverpool", "Liverpol"]) {
    const hit = await client.search(q, 1, 5, { screen: "Phase1 audit", component: `search:${q}` });
    const first = asRecord(unwrapList(hit.body)[0]);
    searches[q] = idOf(first);
  }

  const teamsDir = await client.teams(1, 5, { screen: "Phase1 audit", component: "/teams" });
  const playersDir = await client.players(1, 5, { screen: "Phase1 audit", component: "/players" });
  const tournamentsDir = await client.tournaments(1, 8, { screen: "Phase1 audit", component: "/tournaments" });

  const teamId = idOf(asRecord(unwrapList(teamsDir.body)[0])) || searches.Arsenal;
  const playerId = idOf(asRecord(unwrapList(playersDir.body)[0])) || searches.Salah;
  const tournamentId = idOf(asRecord(unwrapList(tournamentsDir.body)[0])) || searches["Premier League"];

  const seasons = tournamentId
    ? await client.uniqueTournamentSeasons(tournamentId, 1, 5, { screen: "Phase1 audit", component: "seasons" })
    : null;
  const seasonId = idOf(asRecord(unwrapList(seasons?.body || null)[0]));

  const today = new Date().toISOString().slice(0, 10);

  const results: Record<string, Awaited<ReturnType<FootballClient["get"]>>> = {
    events: await client.events({ limit: 10 }, { screen: "Phase1 audit", component: "/events" }),
    eventsLive: await client.events({ status: "inprogress", limit: 10 }, { screen: "Phase1 audit", component: "/events live" }),
    eventsFinished: await client.events({ status: "finished", limit: 10 }, { screen: "Phase1 audit", component: "/events finished" }),
    fixtures,
    teams: teamsDir,
    players: playersDir,
    tournaments: tournamentsDir,
  };

  if (eventId) {
    results.event = await client.event(eventId, { screen: "Phase1 audit", component: "event" });
    results.bestPlayers = await client.eventBestPlayers(eventId, { screen: "Phase1 audit", component: "best-players" });
    results.enrichments = await client.eventEnrichments(eventId, { screen: "Phase1 audit", component: "enrichments" });
    results.h2h = await client.eventH2h(eventId, { screen: "Phase1 audit", component: "h2h" });
    results.incidents = await client.eventIncidents(eventId, { screen: "Phase1 audit", component: "incidents" });
    results.injuries = await client.eventInjuries(eventId, { screen: "Phase1 audit", component: "injuries" });
    results.lineups = await client.eventLineups(eventId, { screen: "Phase1 audit", component: "lineups" });
    results.playerStatistics = await client.eventPlayerStatistics(eventId, { screen: "Phase1 audit", component: "player-statistics" });
    results.pregameForm = await client.eventPregameForm(eventId, { screen: "Phase1 audit", component: "pregame-form" });
    results.statistics = await client.eventStatistics(eventId, { screen: "Phase1 audit", component: "statistics" });
    results.teamStreaks = await client.eventTeamStreaks(eventId, { screen: "Phase1 audit", component: "team-streaks" });
    results.weather = await client.eventWeather(eventId, { screen: "Phase1 audit", component: "weather" });
    const enrichmentTypes = unwrapList(results.enrichments.body)
      .map((item) => (typeof item === "string" ? item : String(asRecord(item)?.type || "")))
      .filter(Boolean);
    results.enrichmentType = await client.eventEnrichmentType(eventId, enrichmentTypes[0] || "best_players", {
      screen: "Phase1 audit",
      component: "enrichments/type",
    });
    if (playerId) {
      results.eventPlayerById = await client.eventPlayerStatisticsById(eventId, playerId, {
        screen: "Phase1 audit",
        component: "event player stats",
      });
    }
  }

  if (teamId) {
    results.team = await client.team(teamId, { screen: "Phase1 audit", component: "team" });
    results.teamPlayers = await client.teamPlayers(teamId, { screen: "Phase1 audit", component: "squad" });
    results.teamLast = await client.teamEvents(teamId, "last", 1, 5, { screen: "Phase1 audit", component: "team last" });
    results.teamNext = await client.teamEvents(teamId, "next", 1, 5, { screen: "Phase1 audit", component: "team next" });
    results.featured = await client.teamFeaturedEvent(teamId, { screen: "Phase1 audit", component: "featured" });
    results.near = await client.teamNearEvents(teamId, { screen: "Phase1 audit", component: "near" });
    results.performance = await client.teamPerformance(teamId, { screen: "Phase1 audit", component: "performance" });
    results.rankings = await client.teamRankings(teamId, 1, 5, { screen: "Phase1 audit", component: "rankings" });
    results.teamTournaments = await client.teamUniqueTournaments(teamId, 1, 5, { screen: "Phase1 audit", component: "team tournaments" });
    results.standingsSeasons = await client.teamStandingsSeasons(teamId, 1, 5, { screen: "Phase1 audit", component: "standings-seasons" });
    results.media = await client.teamMedia(teamId, 1, 5, { screen: "Phase1 audit", component: "media" });
    results.teamEnrichments = await client.teamEnrichments(teamId, { screen: "Phase1 audit", component: "team enrichments" });
    results.teamEnrichmentType = await client.teamEnrichmentType(teamId, TEAM_ENRICHMENT_TYPES[0], {
      screen: "Phase1 audit",
      component: "team enrichments/type",
    });
    if (tournamentId && seasonId) {
      results.teamSeasonStats = await client.teamSeasonStatistics(teamId, tournamentId, seasonId, {
        screen: "Phase1 audit",
        component: "team season stats",
      });
    }
  }

  if (playerId) {
    results.player = await client.player(playerId, { screen: "Phase1 audit", component: "player" });
    results.playerLast = await client.playerEvents(playerId, "last", 1, 5, { screen: "Phase1 audit", component: "player last" });
    results.playerNext = await client.playerEvents(playerId, "next", 1, 5, { screen: "Phase1 audit", component: "player next" });
    if (tournamentId && seasonId) {
      results.playerSeasonStats = await client.playerSeasonStatistics(playerId, tournamentId, seasonId, {
        screen: "Phase1 audit",
        component: "player season stats",
      });
    }
  }

  if (tournamentId) {
    results.uniqueTournament = await client.uniqueTournament(tournamentId, { screen: "Phase1 audit", component: "unique-tournament" });
    results.tournamentEvents = await client.uniqueTournamentEvents(tournamentId, 1, 10, { screen: "Phase1 audit", component: "tournament events" });
    results.scheduled = await client.uniqueTournamentScheduled(tournamentId, today, { screen: "Phase1 audit", component: "scheduled" });
    if (seasonId) {
      results.standingsTotal = await client.uniqueTournamentStandings(tournamentId, seasonId, "total", {
        screen: "Phase1 audit",
        component: "standings/total",
      });
      results.standingsHome = await client.uniqueTournamentStandings(tournamentId, seasonId, "home", {
        screen: "Phase1 audit",
        component: "standings/home",
      });
      results.round = await client.uniqueTournamentRound(tournamentId, seasonId, 1, {
        screen: "Phase1 audit",
        component: "round",
      });
    }
  }

  results.manager = await client.manager(2, { screen: "Phase1 audit", component: "/manager/2" });

  const summary = Object.fromEntries(
    Object.entries(results).map(([key, value]) => [
      key,
      { status: value.status, ms: value.ms, bytes: value.bytes, keys: value.body ? Object.keys(value.body) : [], error: value.error || null },
    ]),
  );

  const report = {
    liveId: eventId || null,
    teamId: teamId || null,
    playerId: playerId || null,
    tournamentId: tournamentId || null,
    seasonId: seasonId || null,
    auth: {
      apimOnly: auth.apimOnly.status,
      liveOnly: auth.liveOnly.status,
      both: auth.both.status,
    },
    searches,
    summary,
    catalog: CATALOG.length,
    endpoints: endpointHealth(),
    experiences: experienceScores(),
    screens: coverageByScreen(),
    totals: catalogTotals(),
    recommendations: recommendationsFromGaps(),
    gaps: ctx.gaps,
  };

  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(join(config.dataDir, "phase1-audit.json"), JSON.stringify(report, null, 2));
  store.persist();
  const md = writeMarkdownReport();
  console.log(JSON.stringify({ eventId, teamId, playerId, tournamentId, seasonId, summary, gapCount: ctx.gaps.length, report: md }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
