import type { Json } from "./types.js";

export function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function unwrapEntity(body: Json | null, key: string): Json | null {
  if (!body) return null;
  const nested = asRecord(body[key]);
  if (nested) return nested;
  if (body.id != null || body.name != null) return body;
  return null;
}

const LIST_KEYS = [
  "items",
  "events",
  "seasons",
  "players",
  "types",
  "media",
  "rankings",
  "incidents",
  "injuries",
  "statistics",
  "groups",
  "uniqueTournaments",
  "uniqueTournamentSeasons",
  "tournamentSeasons",
  "standings",
] as const;

export function unwrapList(body: Json | null): unknown[] {
  if (!body) return [];
  for (const key of LIST_KEYS) {
    if (Array.isArray(body[key])) return body[key] as unknown[];
  }
  return [];
}

export function unwrapEvent(body: Json | null): Json | null {
  return unwrapEntity(body, "event");
}

export function unwrapPlayer(body: Json | null): Json | null {
  return unwrapEntity(body, "player");
}

export function unwrapTeam(body: Json | null): Json | null {
  return unwrapEntity(body, "team");
}

export function unwrapTournament(body: Json | null): Json | null {
  return unwrapEntity(body, "uniqueTournament") || unwrapEntity(body, "tournament");
}

export function unwrapManager(body: Json | null): Json | null {
  return unwrapEntity(body, "manager");
}

export function unwrapStandingsRows(body: Json | null): unknown[] {
  const standings = asArray(body?.standings);
  const first = asRecord(standings[0]);
  return asArray(first?.rows);
}

export function isEmptyPayload(body: Json | null): boolean {
  if (!body) return true;
  const list = unwrapList(body);
  if (list.length > 0) return false;
  if (unwrapEvent(body) || unwrapPlayer(body) || unwrapTeam(body) || unwrapTournament(body) || unwrapManager(body)) {
    return false;
  }
  if (asArray(body.standings).length > 0) return false;
  if (asArray(body.incidents).length > 0) return false;
  if (asRecord(body.statistics)) return false;
  if (asRecord(body.home) || asRecord(body.away)) return false;
  if (asRecord(body.teamDuel) || asRecord(body.managerDuel)) return false;
  return Object.keys(body).length === 0 || (list.length === 0 && !body.event && !body.player && !body.team);
}

export function isOptionalEnrichment404(result: { status: number; body: Json | null; error?: string }): boolean {
  if (result.status !== 404) return false;
  const message = String(result.body?.message || result.error || "").toLowerCase();
  return (
    message.includes("enrichment") ||
    message.includes("no season statistics") ||
    message.includes("not found") ||
    message.includes("no data")
  );
}

export function widgetFromResult(
  result: { status: number; body: Json | null; error?: string },
  emptyNote: string,
): { status: "SUPPORTED" | "EMPTY" | "OPTIONAL_404" | "NO_DATA" | "ERROR"; data: unknown; note?: string } {
  if (isOptionalEnrichment404(result)) {
    return { status: "OPTIONAL_404", data: null, note: emptyNote };
  }
  if (result.status >= 400) {
    return { status: "ERROR", data: null, note: result.error || `HTTP ${result.status}` };
  }
  if (isEmptyPayload(result.body)) {
    return { status: "EMPTY", data: null, note: emptyNote };
  }
  if (result.status === 200 && result.body) {
    return { status: "SUPPORTED", data: result.body };
  }
  return { status: "NO_DATA", data: null, note: emptyNote };
}
