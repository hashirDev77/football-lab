import { CATALOG } from "../raw/catalog.js";
import { store } from "./store.js";
import type { QualityScores, Severity } from "./types.js";

const SCREEN_AREAS = [
  "Home",
  "Matches",
  "Match Centre",
  "Team",
  "Player",
  "Competition",
  "Search",
  "Manager",
];

const EXPERIENCE_MAP: Record<string, string[]> = {
  "MATCH EXPERIENCE": ["Home", "Matches", "Match Centre"],
  "TEAM EXPERIENCE": ["Team", "Teams directory"],
  "PLAYER EXPERIENCE": ["Player", "Players directory", "Manager"],
  "COMPETITION EXPERIENCE": ["Competition", "Competitions"],
  "SEARCH EXPERIENCE": ["Search"],
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreFromGaps(screen: string): QualityScores {
  const gaps = store.byScreen(screen);
  const calls = store.calls.filter((call) => call.screen.toLowerCase() === screen.toLowerCase());
  const p0 = gaps.filter((gap) => gap.severity === "P0").length;
  const p1 = gaps.filter((gap) => gap.severity === "P1").length;
  const p2 = gaps.filter((gap) => gap.severity === "P2").length;
  const missing = gaps.filter((gap) => gap.type === "MISSING_FIELD" || gap.type === "NULL_FIELD").length;
  const schema = gaps.filter((gap) => gap.type === "SCHEMA_INCONSISTENCY" || gap.type === "STATUS_INCONSISTENCY").length;
  const extra = gaps.filter((gap) => gap.type === "EXTRA_REQUEST_REQUIRED" || gap.type === "DERIVATION_REQUIRED").length;
  const slow = calls.filter((call) => call.ms >= 800).length;
  const failed = calls.filter((call) => call.status >= 500 || call.status === 0).length;
  const ok = calls.filter((call) => call.status === 200).length;

  const availability = clamp(100 - failed * 25 - p0 * 40);
  const completeness = clamp(100 - missing * 8 - p1 * 6);
  const consistency = clamp(100 - schema * 12);
  const freshness = clamp(100 - gaps.filter((gap) => gap.type === "STALE_DATA").length * 15);
  const performance = clamp(100 - slow * 8);
  const developerUsability = clamp(100 - extra * 10 - p2 * 3 - (ok === 0 && calls.length > 0 ? 20 : 0));
  const overall = clamp(
    availability * 0.2 +
      completeness * 0.25 +
      consistency * 0.15 +
      freshness * 0.1 +
      performance * 0.1 +
      developerUsability * 0.2,
  );
  return { availability, completeness, consistency, freshness, performance, developerUsability, overall };
}

export function coverageByScreen() {
  const screens = new Set([
    ...SCREEN_AREAS,
    ...store.gaps.map((gap) => gap.screen),
    ...store.calls.map((call) => call.screen),
  ]);
  return [...screens].map((screen) => {
    const gaps = store.byScreen(screen);
    const scores = scoreFromGaps(screen);
    const broken = gaps.filter((gap) => gap.severity === "P0").length;
    const partial = gaps.filter((gap) => gap.severity === "P1" || gap.severity === "P2").length;
    const complete = Math.max(0, 100 - broken * 20 - partial * 8);
    return {
      screen,
      complete,
      partial: Math.min(100, partial * 8),
      broken: Math.min(100, broken * 20),
      scores,
      gapCount: gaps.length,
    };
  });
}

export function experienceScores() {
  return Object.entries(EXPERIENCE_MAP).map(([label, screens]) => {
    const scores = screens.map((screen) => scoreFromGaps(screen).overall);
    const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { label, screens, overall };
  });
}

export function endpointHealth() {
  return CATALOG.map((route) => {
    const template = `^${route.path.replace(/\{[^}]+\}/g, "[^/]+")}$`;
    const matcher = new RegExp(template);
    const gaps = store.gaps.filter((gap) => matcher.test(gap.endpoint.split("?")[0]));
    const calls = store.calls.filter((call) => matcher.test(call.endpoint.split("?")[0]));
    const last = calls[calls.length - 1];
    const empty = last ? last.status === 200 && last.bytes < 20 : false;
    const useful = last ? last.status === 200 && last.bytes >= 20 : false;
    return {
      ...route,
      lastStatus: last?.status ?? null,
      lastMs: last?.ms ?? null,
      lastBytes: last?.bytes ?? null,
      lastTested: last?.timestamp ?? null,
      callCount: calls.length,
      gapCount: gaps.length,
      empty,
      useful,
      worstSeverity: worst(gaps.map((gap) => gap.severity)),
      coverageScore: last
        ? clamp(100 - gaps.length * 8 - (last.status >= 400 ? 40 : 0) - (empty ? 20 : 0))
        : 0,
    };
  });
}

function worst(values: Severity[]): Severity | null {
  if (values.includes("P0")) return "P0";
  if (values.includes("P1")) return "P1";
  if (values.includes("P2")) return "P2";
  if (values.includes("P3")) return "P3";
  return null;
}

export function catalogTotals() {
  const health = endpointHealth();
  const tested = health.filter((row) => row.callCount > 0).length;
  const useful = health.filter((row) => row.useful).length;
  const empty = health.filter((row) => row.empty).length;
  const errors = health.filter((row) => (row.lastStatus ?? 0) >= 400).length;
  return {
    catalog: CATALOG.length,
    tested,
    useful,
    empty,
    errors,
    untested: CATALOG.length - tested,
    missingRelationships: store.gaps.filter((g) => g.type === "BROKEN_RELATIONSHIP").length,
    schemaInconsistencies: store.gaps.filter((g) => g.type === "SCHEMA_INCONSISTENCY").length,
    documentationGaps: store.gaps.filter((g) => g.type === "DOCUMENTATION_GAP").length,
    apiCalls: store.calls.length,
    gapCount: store.gaps.length,
    findingCount: store.findings.length,
  };
}
