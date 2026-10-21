import { loadHome } from "./lib/screens/home";
import { loadMatches } from "./lib/screens/matches";
import {
  loadBestPlayers,
  loadEnrichments,
  loadH2H,
  loadInjuries,
  loadLineups,
  loadMatchOverview,
  loadPlayerStatistics,
  loadStatistics,
  loadTimeline,
} from "./lib/screens/match";
import { loadSearch } from "./lib/screens/search";
import {
  loadPlayer,
  loadPlayerMatches,
  loadPlayerStatistics as loadPlayerSeasonStatistics,
  loadPlayersDirectory,
} from "./lib/screens/player";
import {
  loadManager,
  loadTeam,
  loadTeamCompetitions,
  loadTeamEnrichments,
  loadTeamMatches,
  loadTeamMedia,
  loadTeamPerformance,
  loadTeamRankings,
  loadTeamSquad,
  loadTeamStatistics,
  loadTeamsDirectory,
} from "./lib/screens/team";
import {
  loadTournament,
  loadTournamentMatches,
  loadTournamentRound,
  loadTournamentSeasons,
  loadTournamentStandings,
  loadTournaments,
} from "./lib/screens/tournament";
import type { StandingsType } from "./lib/raw/types";
import {
  addFinding,
  loadCoverage,
  loadEndpointLab,
  loadGap,
  loadGaps,
  loadGapsByScreen,
  loadReport,
  loadReportCsv,
  probeEndpoint,
} from "./lib/admin";
import type { GapType, Severity } from "./lib/gaps/types";

function idParam(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePath(path: string) {
  const url = new URL(path, "http://local.frontend");
  return { pathname: url.pathname.replace(/\/$/, "") || "/", query: url.searchParams };
}

function matchRoute(pathname: string, pattern: string) {
  const pathParts = pathname.split("/");
  const patternParts = pattern.split("/");
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

async function dispatchGet(path: string): Promise<unknown> {
  const { pathname, query } = parsePath(path);

  if (matchRoute(pathname, "/app/football/home")) return loadHome();
  if (matchRoute(pathname, "/app/football/matches")) {
    return loadMatches({
      tab: query.get("tab") || undefined,
      tournamentId: query.get("tournamentId") ? Number(query.get("tournamentId")) : undefined,
      status: query.get("status") || undefined,
    });
  }
  let params = matchRoute(pathname, "/app/football/matches/:id");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadMatchOverview(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/timeline");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadTimeline(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/lineups");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadLineups(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/statistics");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadStatistics(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/player-statistics");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    const playerId = Number(query.get("playerId"));
    return loadPlayerStatistics(id, Number.isFinite(playerId) ? playerId : undefined);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/best-players");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadBestPlayers(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/h2h");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadH2H(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/injuries");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadInjuries(id);
  }
  params = matchRoute(pathname, "/app/football/matches/:id/enrichments");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid match id");
    return loadEnrichments(id, query.get("type") || undefined);
  }
  if (matchRoute(pathname, "/app/football/search")) {
    const q = String(query.get("q") || "").trim();
    if (q.length < 2) throw new Error("Query must be at least 2 characters");
    return loadSearch(q);
  }
  if (matchRoute(pathname, "/app/football/players")) {
    return loadPlayersDirectory(Number(query.get("page") || 1));
  }
  params = matchRoute(pathname, "/app/football/players/:id");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid player id");
    return loadPlayer(id);
  }
  params = matchRoute(pathname, "/app/football/players/:id/matches");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid player id");
    return loadPlayerMatches(id);
  }
  params = matchRoute(pathname, "/app/football/players/:id/statistics");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid player id");
    return loadPlayerSeasonStatistics(
      id,
      query.get("tournamentId") ? Number(query.get("tournamentId")) : undefined,
      query.get("seasonId") ? Number(query.get("seasonId")) : undefined,
    );
  }
  if (matchRoute(pathname, "/app/football/teams")) {
    return loadTeamsDirectory(Number(query.get("page") || 1));
  }
  params = matchRoute(pathname, "/app/football/teams/:id");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeam(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/matches");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamMatches(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/squad");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamSquad(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/performance");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamPerformance(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/rankings");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamRankings(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/competitions");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamCompetitions(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/statistics");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamStatistics(
      id,
      query.get("tournamentId") ? Number(query.get("tournamentId")) : undefined,
      query.get("seasonId") ? Number(query.get("seasonId")) : undefined,
    );
  }
  params = matchRoute(pathname, "/app/football/teams/:id/media");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamMedia(id);
  }
  params = matchRoute(pathname, "/app/football/teams/:id/enrichments");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid team id");
    return loadTeamEnrichments(id, query.get("type") || undefined);
  }
  if (matchRoute(pathname, "/app/football/competitions")) return loadTournaments(Number(query.get("page") || 1));
  params = matchRoute(pathname, "/app/football/competitions/:id");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid competition id");
    return loadTournament(id);
  }
  params = matchRoute(pathname, "/app/football/competitions/:id/matches");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid competition id");
    return loadTournamentMatches(id, query.get("date") || undefined);
  }
  params = matchRoute(pathname, "/app/football/competitions/:id/standings");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid competition id");
    const seasonId = query.get("seasonId");
    if (!seasonId) throw new Error("seasonId is required");
    return loadTournamentStandings(id, Number(seasonId), (query.get("type") as StandingsType) || "total");
  }
  params = matchRoute(pathname, "/app/football/competitions/:id/seasons");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid competition id");
    return loadTournamentSeasons(id);
  }
  params = matchRoute(pathname, "/app/football/competitions/:id/round");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid competition id");
    const seasonId = query.get("seasonId");
    const round = query.get("round");
    if (!seasonId || !round) throw new Error("seasonId and round are required");
    return loadTournamentRound(id, Number(seasonId), round);
  }
  params = matchRoute(pathname, "/app/football/managers/:id");
  if (params) {
    const id = idParam(params.id);
    if (!id) throw new Error("Invalid manager id");
    return loadManager(id);
  }

  if (matchRoute(pathname, "/admin/football/gaps")) return loadGaps();
  params = matchRoute(pathname, "/admin/football/gaps/screen/:screen");
  if (params) return loadGapsByScreen(params.screen);
  params = matchRoute(pathname, "/admin/football/gaps/:id");
  if (params) return loadGap(params.id);
  if (matchRoute(pathname, "/admin/football/coverage")) return loadCoverage();
  if (matchRoute(pathname, "/admin/football/endpoint-lab")) return loadEndpointLab();
  if (matchRoute(pathname, "/admin/football/report.csv")) return loadReportCsv();
  if (matchRoute(pathname, "/admin/football/report")) return loadReport();

  throw new Error(`Unknown path: ${pathname}`);
}

export async function getJson<T = any>(path: string): Promise<T> {
  try {
    return (await dispatchGet(path)) as T;
  } catch (err) {
    throw err instanceof Error ? err : new Error("This information could not be loaded.");
  }
}

export async function postJson<T = any>(path: string, body: unknown): Promise<T> {
  const { pathname } = parsePath(path);
  if (matchRoute(pathname, "/admin/football/findings")) {
    return addFinding(
      body as {
        screen: string;
        endpoint: string;
        severity: Severity;
        category: GapType;
        expected: string;
        actual: string;
        userImpact: string;
        developerImpact: string;
        notes?: string;
      },
    ) as T;
  }
  if (matchRoute(pathname, "/admin/football/endpoint-lab/probe")) {
    const payload = body as { path: string; params?: Record<string, string | number> };
    if (!payload?.path) throw new Error("path is required");
    return (await probeEndpoint(payload.path, payload.params)) as T;
  }
  throw new Error(`Unknown path: ${pathname}`);
}

export interface Meta {
  calls: { minimum: number; actual: number; fallback: number; sequential: number; parallel: number };
  gaps: Array<{ id: string; code: string; type: string; severity: string; expected: string; actual: string }>;
}

export interface TeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  logo?: string | null;
}

export interface Match {
  id: number;
  status: { code: string; label: string; description?: string | null };
  startTime: string | null;
  minute: number | null;
  tournament: { id: number | null; name: string | null };
  round: string | null;
  season: string | null;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: {
    home: { current: number | null; display: string | null };
    away: { current: number | null; display: string | null };
  };
  venue: string | null;
  referee: string | null;
  result: string | null;
}

export interface Player {
  id: number;
  name: string | null;
  team: TeamRef | null;
  country: string | null;
  position: string | null;
  shirtNumber: number | null;
  age: number | null;
  image: string | null;
}

export interface Widget {
  status: string;
  data?: unknown;
  note?: string;
}

export interface Health {
  coverage: number;
  checks: Array<{ field: string; status: string; expected: string; actual: string }>;
}
