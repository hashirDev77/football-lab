export interface CatalogRoute {
  path: string;
  screen: string;
  family: string;
  status: "tested" | "needs_testing";
  notes?: string;
}

export const CATALOG: CatalogRoute[] = [
  { path: "/event/{eventId}", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/best-players", screen: "Match Centre", family: "match", status: "needs_testing", notes: "optional 404" },
  { path: "/event/{eventId}/enrichments", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/enrichments/{type}", screen: "Match Centre", family: "match", status: "needs_testing", notes: "optional 404" },
  { path: "/event/{eventId}/h2h", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/incidents", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/injuries", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/lineups", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/player-statistics", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/player/{playerId}/statistics", screen: "Match Centre", family: "match", status: "needs_testing", notes: "404 if player not in XI" },
  { path: "/event/{eventId}/pregame-form", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/statistics", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/event/{eventId}/team-streaks", screen: "Match Centre", family: "match", status: "needs_testing", notes: "optional 404" },
  { path: "/event/{eventId}/weather", screen: "Match Centre", family: "match", status: "needs_testing" },
  { path: "/events", screen: "Matches", family: "lists", status: "needs_testing" },
  { path: "/fixtures/today", screen: "Home", family: "lists", status: "needs_testing" },
  { path: "/manager/{managerId}", screen: "Manager", family: "manager", status: "needs_testing" },
  { path: "/player/{playerId}", screen: "Player", family: "player", status: "needs_testing" },
  { path: "/player/{playerId}/events/{direction}", screen: "Player", family: "player", status: "needs_testing" },
  { path: "/player/{playerId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics", screen: "Player", family: "player", status: "needs_testing" },
  { path: "/players", screen: "Players directory", family: "lists", status: "needs_testing" },
  { path: "/search", screen: "Search", family: "lists", status: "needs_testing" },
  { path: "/team/{teamId}", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/enrichments", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/enrichments/{type}", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/events/{direction}", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/featured-event", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/media", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/near-events", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/performance", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/players", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/rankings", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/standings-seasons", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/team/{teamId}/unique-tournaments", screen: "Team", family: "team", status: "needs_testing" },
  { path: "/teams", screen: "Teams directory", family: "lists", status: "needs_testing" },
  { path: "/tournaments", screen: "Competitions", family: "lists", status: "needs_testing" },
  { path: "/unique-tournament/{tournamentId}", screen: "Competition", family: "competition", status: "needs_testing" },
  { path: "/unique-tournament/{tournamentId}/events", screen: "Competition", family: "competition", status: "needs_testing" },
  { path: "/unique-tournament/{tournamentId}/scheduled-events/{date}", screen: "Competition", family: "competition", status: "needs_testing" },
  { path: "/unique-tournament/{tournamentId}/season/{seasonId}/round/{round}", screen: "Competition", family: "competition", status: "needs_testing" },
  { path: "/unique-tournament/{tournamentId}/season/{seasonId}/standings/{type}", screen: "Competition", family: "competition", status: "needs_testing" },
  { path: "/unique-tournament/{tournamentId}/seasons", screen: "Competition", family: "competition", status: "needs_testing" },
];
