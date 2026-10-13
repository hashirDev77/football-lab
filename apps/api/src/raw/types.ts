export type Json = Record<string, unknown>;

export interface ProviderResult {
  endpoint: string;
  params?: Record<string, string | number | undefined>;
  status: number;
  ms: number;
  bytes: number;
  body: Json | null;
  error?: string;
  timestamp: string;
}

export type EventDirection = "last" | "next";
export type StandingsType = "total" | "home" | "away";
export type EventStatusFilter = "notstarted" | "inprogress" | "finished";
export type TeamEnrichmentType =
  | "events_last"
  | "events_next"
  | "featured_event"
  | "media"
  | "near_events"
  | "performance"
  | "standings_seasons"
  | "unique_tournaments_all";

export const TEAM_ENRICHMENT_TYPES: TeamEnrichmentType[] = [
  "events_last",
  "events_next",
  "featured_event",
  "media",
  "near_events",
  "performance",
  "standings_seasons",
  "unique_tournaments_all",
];
