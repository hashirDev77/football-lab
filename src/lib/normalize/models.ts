export interface FootballStatus {
  code: string;
  label: string;
  description?: string | null;
}

export interface FootballScore {
  current: number | null;
  display: string | null;
  ht: number | null;
  et: number | null;
  penalties: number | null;
  source: "list" | "event" | "missing";
}

export interface FootballTeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  country?: string | null;
  logo?: string | null;
}

export interface FootballTournamentRef {
  id: number | null;
  name: string | null;
}

export interface FootballMatch {
  id: number;
  status: FootballStatus;
  startTime: string | null;
  minute: number | null;
  tournament: FootballTournamentRef;
  round: string | null;
  season: string | null;
  homeTeam: FootballTeamRef;
  awayTeam: FootballTeamRef;
  score: { home: FootballScore; away: FootballScore };
  venue: string | null;
  referee: string | null;
  result: string | null;
}

export interface FootballPlayer {
  id: number;
  name: string | null;
  team: FootballTeamRef | null;
  country: string | null;
  position: string | null;
  shirtNumber: number | null;
  age: number | null;
  dateOfBirth: string | null;
  height: number | null;
  image: string | null;
}

export interface FootballTournament {
  id: number;
  name: string | null;
  country: string | null;
  category: string | null;
  logo: string | null;
  currentSeasonId: number | null;
  active: boolean | null;
}

export interface FootballSeason {
  id: number;
  name: string | null;
  year: string | null;
}

export interface FootballIncident {
  type: string | null;
  minute: number | null;
  addedTime: number | null;
  playerId: number | null;
  playerName: string | null;
  assistId: number | null;
  assistName: string | null;
  teamId: number | null;
  teamName: string | null;
  isHome: boolean | null;
  scoreHome: number | null;
  scoreAway: number | null;
  raw: Record<string, unknown>;
}

export interface FootballLineupPlayer {
  playerId: number | null;
  name: string | null;
  position: string | null;
  shirtNumber: number | null;
  substitute: boolean;
  captain: boolean | null;
  rating: number | null;
}

export interface FootballLineupSide {
  teamId: number | null;
  teamName: string | null;
  formation: string | null;
  managerId: number | null;
  managerName: string | null;
  starters: FootballLineupPlayer[];
  substitutes: FootballLineupPlayer[];
}

export interface FootballStanding {
  position: number | null;
  team: FootballTeamRef;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
  points: number | null;
  form: string | null;
  raw: Record<string, unknown>;
}

export interface SearchHit {
  type: "player" | "team" | "tournament" | "unknown";
  id: number | null;
  name: string | null;
  image?: string | null;
  country?: string | null;
  team?: string | null;
  competition?: string | null;
}

export interface StatRow {
  name: string;
  home: string | number | null;
  away: string | number | null;
}
