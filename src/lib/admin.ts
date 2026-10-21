import { CATALOG } from "./raw/catalog";
import { FootballClient } from "./raw/client";
import { store } from "./gaps/store";
import { catalogTotals, coverageByScreen, endpointHealth, experienceScores, scoreFromGaps } from "./gaps/scoring";
import { recommendationsFromGaps } from "./gaps/recommendations";
import { RequestContext, withClient } from "./gaps/context";
import type { GapType, Severity } from "./gaps/types";

export function loadGaps() {
  return {
    total: store.gaps.length,
    calls: store.calls.length,
    gaps: [...store.gaps].reverse(),
    findings: [...store.findings].reverse(),
    recommendations: recommendationsFromGaps(),
  };
}

export function addFinding(body: {
  screen: string;
  endpoint: string;
  severity: Severity;
  category: GapType;
  expected: string;
  actual: string;
  userImpact: string;
  developerImpact: string;
  notes?: string;
}) {
  const finding = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...body,
  };
  store.addFinding(finding);
  return { ok: true, finding };
}

export function loadGapsByScreen(screen: string) {
  return { screen, gaps: store.byScreen(screen), scores: scoreFromGaps(screen) };
}

export function loadGapsByEndpoint(endpoint: string) {
  return { endpoint, gaps: store.byEndpoint(endpoint) };
}

export function loadGap(id: string) {
  const gap = store.gaps.find((item) => item.id === id);
  if (!gap) throw new Error("Gap not found");
  const relatedCalls = store.calls
    .filter((call) => call.endpoint === gap.endpoint || call.screen === gap.screen)
    .slice(-20);
  return { gap, relatedCalls };
}

export function loadCoverage() {
  return {
    screens: coverageByScreen(),
    experiences: experienceScores(),
    endpoints: endpointHealth(),
    catalog: CATALOG,
    totals: {
      ...catalogTotals(),
      matches: new Set(store.calls.filter((c) => c.endpoint.includes("/event/")).map((c) => c.endpoint)).size,
      teams: new Set(store.calls.filter((c) => c.endpoint.includes("/team/")).map((c) => c.endpoint)).size,
      players: new Set(store.calls.filter((c) => c.endpoint.includes("/player/")).map((c) => c.endpoint)).size,
      tournaments: new Set(store.calls.filter((c) => c.endpoint.includes("tournament")).map((c) => c.endpoint)).size,
      averageMs: store.calls.length
        ? Math.round(store.calls.reduce((sum, call) => sum + call.ms, 0) / store.calls.length)
        : 0,
      missingFields: store.gaps.filter((g) => g.type === "MISSING_FIELD" || g.type === "NULL_FIELD").length,
      fallbackCalls: store.calls.filter((c) => c.fallbackUsed).length,
      optional404: store.gaps.filter((g) => g.type === "OPTIONAL_404").length,
      schema: store.gaps.filter((g) => g.type === "SCHEMA_INCONSISTENCY").length,
      brokenRelationships: store.gaps.filter((g) => g.type === "BROKEN_RELATIONSHIP").length,
    },
  };
}

export function loadEndpointLab() {
  return {
    catalog: CATALOG,
    endpoints: endpointHealth(),
    totals: catalogTotals(),
  };
}

export async function probeEndpoint(path: string, params?: Record<string, string | number>) {
  const ctx = new RequestContext("Endpoint Lab", path);
  const client = new FootballClient(withClient(ctx).onCall);
  const result = await client.get(path.replace(/^\//, ""), params, {
    screen: "Endpoint Lab",
    component: path,
  });
  return {
    request: { path, params: params || {} },
    result: {
      status: result.status,
      ms: result.ms,
      bytes: result.bytes,
      error: result.error || null,
      body: result.body,
    },
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}

export function loadReport() {
  return {
    generatedAt: new Date().toISOString(),
    totals: catalogTotals(),
    experiences: experienceScores(),
    screens: coverageByScreen(),
    endpoints: endpointHealth(),
    gaps: store.gaps,
    findings: store.findings,
    recommendations: recommendationsFromGaps(),
  };
}

export function loadReportCsv() {
  const header = "severity,code,screen,endpoint,expected,actual,userImpact\n";
  const rows = store.gaps
    .map((gap) =>
      [gap.severity, gap.code, gap.screen, gap.endpoint, csv(gap.expected), csv(gap.actual), csv(gap.userImpact)].join(","),
    )
    .join("\n");
  return header + rows;
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
