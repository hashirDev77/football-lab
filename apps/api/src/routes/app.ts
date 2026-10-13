import type { FastifyInstance } from "fastify";
import { loadHome } from "../screens/home.js";
import { loadMatches } from "../screens/matches.js";
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
} from "../screens/match.js";
import { loadSearch } from "../screens/search.js";
import {
  loadPlayer,
  loadPlayerMatches,
  loadPlayerStatistics as loadPlayerSeasonStatistics,
  loadPlayersDirectory,
} from "../screens/player.js";
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
  loadTeamStandingsSeasons,
  loadTeamStatistics,
  loadTeamsDirectory,
} from "../screens/team.js";
import {
  loadTournament,
  loadTournamentMatches,
  loadTournamentRound,
  loadTournamentSeasons,
  loadTournamentStandings,
  loadTournaments,
} from "../screens/tournament.js";
import type { StandingsType } from "../raw/types.js";

function idParam(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function registerAppRoutes(app: FastifyInstance) {
  app.get("/app/football/home", async () => loadHome());
  app.get("/app/football/matches", async (req) => {
    const q = req.query as { tab?: string; tournamentId?: string; status?: string };
    return loadMatches({
      tab: q.tab,
      tournamentId: q.tournamentId ? Number(q.tournamentId) : undefined,
      status: q.status,
    });
  });
  app.get("/app/football/matches/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadMatchOverview(id);
  });
  app.get("/app/football/matches/:id/timeline", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadTimeline(id);
  });
  app.get("/app/football/matches/:id/lineups", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadLineups(id);
  });
  app.get("/app/football/matches/:id/statistics", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadStatistics(id);
  });
  app.get("/app/football/matches/:id/player-statistics", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    const playerId = Number((req.query as { playerId?: string }).playerId);
    return loadPlayerStatistics(id, Number.isFinite(playerId) ? playerId : undefined);
  });
  app.get("/app/football/matches/:id/best-players", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadBestPlayers(id);
  });
  app.get("/app/football/matches/:id/h2h", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadH2H(id);
  });
  app.get("/app/football/matches/:id/injuries", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    return loadInjuries(id);
  });
  app.get("/app/football/matches/:id/enrichments", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid match id" });
    const type = (req.query as { type?: string }).type;
    return loadEnrichments(id, type);
  });
  app.get("/app/football/search", async (req, reply) => {
    const q = String((req.query as { q?: string }).q || "").trim();
    if (q.length < 2) return reply.code(400).send({ error: "Query must be at least 2 characters" });
    return loadSearch(q);
  });
  app.get("/app/football/players", async (req) => {
    const page = Number((req.query as { page?: string }).page || 1);
    return loadPlayersDirectory(page);
  });
  app.get("/app/football/players/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid player id" });
    return loadPlayer(id);
  });
  app.get("/app/football/players/:id/matches", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid player id" });
    return loadPlayerMatches(id);
  });
  app.get("/app/football/players/:id/statistics", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid player id" });
    const q = req.query as { tournamentId?: string; seasonId?: string };
    return loadPlayerSeasonStatistics(
      id,
      q.tournamentId ? Number(q.tournamentId) : undefined,
      q.seasonId ? Number(q.seasonId) : undefined,
    );
  });
  app.get("/app/football/teams", async (req) => {
    const page = Number((req.query as { page?: string }).page || 1);
    return loadTeamsDirectory(page);
  });
  app.get("/app/football/teams/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeam(id);
  });
  app.get("/app/football/teams/:id/matches", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamMatches(id);
  });
  app.get("/app/football/teams/:id/squad", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamSquad(id);
  });
  app.get("/app/football/teams/:id/performance", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamPerformance(id);
  });
  app.get("/app/football/teams/:id/rankings", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamRankings(id);
  });
  app.get("/app/football/teams/:id/competitions", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamCompetitions(id);
  });
  app.get("/app/football/teams/:id/standings-seasons", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamStandingsSeasons(id);
  });
  app.get("/app/football/teams/:id/statistics", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    const q = req.query as { tournamentId?: string; seasonId?: string };
    return loadTeamStatistics(id, q.tournamentId ? Number(q.tournamentId) : undefined, q.seasonId ? Number(q.seasonId) : undefined);
  });
  app.get("/app/football/teams/:id/media", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamMedia(id);
  });
  app.get("/app/football/teams/:id/enrichments", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid team id" });
    return loadTeamEnrichments(id, (req.query as { type?: string }).type);
  });
  app.get("/app/football/competitions", async (req) => {
    const page = Number((req.query as { page?: string }).page || 1);
    return loadTournaments(page);
  });
  app.get("/app/football/competitions/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid competition id" });
    return loadTournament(id);
  });
  app.get("/app/football/competitions/:id/matches", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid competition id" });
    const date = (req.query as { date?: string }).date;
    return loadTournamentMatches(id, date);
  });
  app.get("/app/football/competitions/:id/standings", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid competition id" });
    const q = req.query as { seasonId?: string; type?: StandingsType };
    if (!q.seasonId) return reply.code(400).send({ error: "seasonId is required" });
    return loadTournamentStandings(id, Number(q.seasonId), q.type || "total");
  });
  app.get("/app/football/competitions/:id/seasons", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid competition id" });
    return loadTournamentSeasons(id);
  });
  app.get("/app/football/competitions/:id/round", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid competition id" });
    const q = req.query as { seasonId?: string; round?: string };
    if (!q.seasonId || !q.round) return reply.code(400).send({ error: "seasonId and round are required" });
    return loadTournamentRound(id, Number(q.seasonId), q.round);
  });
  app.get("/app/football/managers/:id", async (req, reply) => {
    const id = idParam((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "Invalid manager id" });
    return loadManager(id);
  });
}
