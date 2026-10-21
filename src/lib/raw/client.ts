import { footballUrl, providerHeaders } from "../config.js";
import type { EventDirection, Json, ProviderResult, StandingsType, TeamEnrichmentType } from "./types.js";

export interface CallHook {
  screen?: string;
  component?: string;
  fallback?: boolean;
  fallbackEndpoint?: string;
}

export type OnCall = (result: ProviderResult, hook?: CallHook) => void;

const SLOW_MS = 800;

export class FootballClient {
  constructor(private readonly onCall?: OnCall) {}

  async get(
    endpoint: string,
    params?: Record<string, string | number | undefined>,
    hook?: CallHook,
    headerOpts?: { apim?: boolean; live?: boolean },
  ): Promise<ProviderResult> {
    const url = new URL(footballUrl(endpoint), typeof window === "undefined" ? "http://localhost" : window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }
    }

    const started = Date.now();
    let status = 0;
    let bytes = 0;
    let body: Json | null = null;
    let error: string | undefined;

    try {
      const response = await fetch(url, {
        headers: providerHeaders(headerOpts),
        signal: AbortSignal.timeout(45000),
      });
      status = response.status;
      const text = await response.text();
      bytes = new TextEncoder().encode(text).length;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json") && text) {
        try {
          body = JSON.parse(text) as Json;
        } catch {
          error = "Failed to parse JSON response";
        }
      } else if (text.toLowerCase().includes("sorry, you have been blocked")) {
        error = "Cloudflare blocked the request";
      } else if (!response.ok) {
        error = text.slice(0, 500);
      }
      if (!response.ok && body) {
        error = String(body.message || body.error || error || `HTTP ${status}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      status = status || 0;
    }

    const result: ProviderResult = {
      endpoint: `/${endpoint}`,
      params,
      status,
      ms: Date.now() - started,
      bytes,
      body,
      error,
      timestamp: new Date().toISOString(),
    };
    this.onCall?.(result, hook);
    return result;
  }

  search(q: string, page = 1, limit = 10, hook?: CallHook) {
    return this.get("search", { q, page, limit }, hook);
  }
  fixturesToday(page?: number, limit?: number, hook?: CallHook) {
    return this.get("fixtures/today", { page, limit }, hook);
  }
  events(opts?: { status?: string; page?: number; limit?: number; tournamentId?: number }, hook?: CallHook) {
    return this.get(
      "events",
      {
        status: opts?.status,
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 10,
        tournamentId: opts?.tournamentId,
      },
      hook,
    );
  }
  event(id: number, hook?: CallHook) {
    return this.get(`event/${id}`, undefined, hook);
  }
  eventBestPlayers(id: number, hook?: CallHook) {
    return this.get(`event/${id}/best-players`, undefined, hook);
  }
  eventEnrichments(id: number, hook?: CallHook) {
    return this.get(`event/${id}/enrichments`, undefined, hook);
  }
  eventEnrichmentType(id: number, type: string, hook?: CallHook) {
    return this.get(`event/${id}/enrichments/${type}`, undefined, hook);
  }
  eventH2h(id: number, hook?: CallHook) {
    return this.get(`event/${id}/h2h`, undefined, hook);
  }
  eventIncidents(id: number, hook?: CallHook) {
    return this.get(`event/${id}/incidents`, undefined, hook);
  }
  eventInjuries(id: number, hook?: CallHook) {
    return this.get(`event/${id}/injuries`, undefined, hook);
  }
  eventLineups(id: number, hook?: CallHook) {
    return this.get(`event/${id}/lineups`, undefined, hook);
  }
  eventPlayerStatistics(id: number, hook?: CallHook) {
    return this.get(`event/${id}/player-statistics`, undefined, hook);
  }
  eventPlayerStatisticsById(eventId: number, playerId: number, hook?: CallHook) {
    return this.get(`event/${eventId}/player/${playerId}/statistics`, undefined, hook);
  }
  eventPregameForm(id: number, hook?: CallHook) {
    return this.get(`event/${id}/pregame-form`, undefined, hook);
  }
  eventStatistics(id: number, hook?: CallHook) {
    return this.get(`event/${id}/statistics`, undefined, hook);
  }
  eventTeamStreaks(id: number, hook?: CallHook) {
    return this.get(`event/${id}/team-streaks`, undefined, hook);
  }
  eventWeather(id: number, hook?: CallHook) {
    return this.get(`event/${id}/weather`, undefined, hook);
  }
  manager(id: number, hook?: CallHook) {
    return this.get(`manager/${id}`, undefined, hook);
  }
  player(id: number, hook?: CallHook) {
    return this.get(`player/${id}`, undefined, hook);
  }
  playerEvents(id: number, direction: EventDirection, page = 1, limit = 10, hook?: CallHook) {
    return this.get(`player/${id}/events/${direction}`, { page, limit }, hook);
  }
  playerSeasonStatistics(playerId: number, tournamentId: number, seasonId: number, hook?: CallHook) {
    return this.get(
      `player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics`,
      undefined,
      hook,
    );
  }
  players(page = 1, limit = 20, hook?: CallHook) {
    return this.get("players", { page, limit }, hook);
  }
  team(id: number, hook?: CallHook) {
    return this.get(`team/${id}`, undefined, hook);
  }
  teamEnrichments(id: number, hook?: CallHook) {
    return this.get(`team/${id}/enrichments`, undefined, hook);
  }
  teamEnrichmentType(id: number, type: TeamEnrichmentType | string, hook?: CallHook) {
    return this.get(`team/${id}/enrichments/${type}`, undefined, hook);
  }
  teamEvents(id: number, direction: EventDirection, page = 1, limit = 10, hook?: CallHook) {
    return this.get(`team/${id}/events/${direction}`, { page, limit }, hook);
  }
  teamFeaturedEvent(id: number, hook?: CallHook) {
    return this.get(`team/${id}/featured-event`, undefined, hook);
  }
  teamMedia(id: number, page = 1, limit = 20, hook?: CallHook) {
    return this.get(`team/${id}/media`, { page, limit }, hook);
  }
  teamNearEvents(id: number, hook?: CallHook) {
    return this.get(`team/${id}/near-events`, undefined, hook);
  }
  teamPerformance(id: number, hook?: CallHook) {
    return this.get(`team/${id}/performance`, undefined, hook);
  }
  teamPlayers(id: number, hook?: CallHook) {
    return this.get(`team/${id}/players`, undefined, hook);
  }
  teamRankings(id: number, page = 1, limit = 20, hook?: CallHook) {
    return this.get(`team/${id}/rankings`, { page, limit }, hook);
  }
  teamStandingsSeasons(id: number, page = 1, limit = 20, hook?: CallHook) {
    return this.get(`team/${id}/standings-seasons`, { page, limit }, hook);
  }
  teamSeasonStatistics(teamId: number, tournamentId: number, seasonId: number, hook?: CallHook) {
    return this.get(
      `team/${teamId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics`,
      undefined,
      hook,
    );
  }
  teamUniqueTournaments(id: number, page = 1, limit = 20, hook?: CallHook) {
    return this.get(`team/${id}/unique-tournaments`, { page, limit }, hook);
  }
  teams(page = 1, limit = 20, hook?: CallHook) {
    return this.get("teams", { page, limit }, hook);
  }
  tournaments(page = 1, limit = 20, hook?: CallHook) {
    return this.get("tournaments", { page, limit }, hook);
  }
  uniqueTournament(id: number, hook?: CallHook) {
    return this.get(`unique-tournament/${id}`, undefined, hook);
  }
  uniqueTournamentEvents(id: number, page = 1, limit = 20, hook?: CallHook) {
    return this.get(`unique-tournament/${id}/events`, { page, limit }, hook);
  }
  uniqueTournamentScheduled(id: number, date: string, hook?: CallHook) {
    return this.get(`unique-tournament/${id}/scheduled-events/${date}`, undefined, hook);
  }
  uniqueTournamentRound(id: number, seasonId: number, round: string | number, hook?: CallHook) {
    return this.get(`unique-tournament/${id}/season/${seasonId}/round/${round}`, undefined, hook);
  }
  uniqueTournamentStandings(id: number, seasonId: number, type: StandingsType, hook?: CallHook) {
    return this.get(`unique-tournament/${id}/season/${seasonId}/standings/${type}`, undefined, hook);
  }
  uniqueTournamentSeasons(id: number, page = 1, limit = 20, hook?: CallHook) {
    return this.get(`unique-tournament/${id}/seasons`, { page, limit }, hook);
  }
}

export { SLOW_MS };
