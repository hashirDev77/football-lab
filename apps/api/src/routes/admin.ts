import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { CATALOG } from "../raw/catalog.js";
import { FootballClient } from "../raw/client.js";
import { store } from "../gaps/store.js";
import { catalogTotals, coverageByScreen, endpointHealth, experienceScores, scoreFromGaps } from "../gaps/scoring.js";
import { recommendationsFromGaps } from "../gaps/recommendations.js";
import type { GapType, Severity } from "../gaps/types.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { writeMarkdownReport } from "../audit/writeReport.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/football/gaps", async () => ({
    total: store.gaps.length,
    calls: store.calls.length,
    gaps: [...store.gaps].reverse(),
    findings: [...store.findings].reverse(),
    recommendations: recommendationsFromGaps(),
  }));

  app.post("/admin/football/findings", async (req) => {
    const body = req.body as {
      screen: string;
      endpoint: string;
      severity: Severity;
      category: GapType;
      expected: string;
      actual: string;
      userImpact: string;
      developerImpact: string;
      notes?: string;
    };
    const finding = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...body,
    };
    store.addFinding(finding);
    return { ok: true, finding };
  });

  app.get("/admin/football/gaps/screen/:screen", async (req) => {
    const screen = decodeURIComponent((req.params as { screen: string }).screen);
    return { screen, gaps: store.byScreen(screen), scores: scoreFromGaps(screen) };
  });

  app.get("/admin/football/gaps/endpoint/:endpoint", async (req) => {
    const endpoint = decodeURIComponent((req.params as { endpoint: string }).endpoint);
    return { endpoint, gaps: store.byEndpoint(endpoint) };
  });

  app.get("/admin/football/gaps/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const gap = store.gaps.find((item) => item.id === id);
    if (!gap) return reply.code(404).send({ error: "Gap not found" });
    const relatedCalls = store.calls
      .filter((call) => call.endpoint === gap.endpoint || call.screen === gap.screen)
      .slice(-20);
    return { gap, relatedCalls };
  });

  app.get("/admin/football/coverage", async () => ({
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
  }));

  app.get("/admin/football/endpoint-lab", async () => ({
    catalog: CATALOG,
    endpoints: endpointHealth(),
    totals: catalogTotals(),
  }));

  app.post("/admin/football/endpoint-lab/probe", async (req, reply) => {
    const body = req.body as { path: string; params?: Record<string, string | number> };
    if (!body?.path) return reply.code(400).send({ error: "path is required" });
    const ctx = new RequestContext("Endpoint Lab", body.path);
    const client = new FootballClient(withClient(ctx).onCall);
    const result = await client.get(body.path.replace(/^\//, ""), body.params, {
      screen: "Endpoint Lab",
      component: body.path,
    });
    return {
      request: { path: body.path, params: body.params || {} },
      result: {
        status: result.status,
        ms: result.ms,
        bytes: result.bytes,
        error: result.error || null,
        body: result.body,
      },
      _meta: { calls: ctx.meta(), gaps: ctx.gaps },
    };
  });

  app.get("/admin/football/relationships", async () => ({ items: store.relationships.slice(-200) }));
  app.get("/admin/football/schema-drift", async () => ({ items: store.schemaNotes, gaps: store.byEndpoint("status") }));
  app.get("/admin/football/calls", async () => ({ items: store.calls.slice(-200).reverse() }));

  app.get("/admin/football/report", async () => {
    const endpoints = endpointHealth();
    const screens = coverageByScreen();
    const markdownPath = writeMarkdownReport();
    return {
      generatedAt: new Date().toISOString(),
      markdownPath,
      totals: catalogTotals(),
      experiences: experienceScores(),
      screens,
      endpoints,
      gaps: store.gaps,
      findings: store.findings,
      recommendations: recommendationsFromGaps(),
    };
  });

  app.get("/admin/football/report.csv", async (_req, reply) => {
    const header = "severity,code,screen,endpoint,expected,actual,userImpact\n";
    const rows = store.gaps
      .map((gap) =>
        [gap.severity, gap.code, gap.screen, gap.endpoint, csv(gap.expected), csv(gap.actual), csv(gap.userImpact)].join(","),
      )
      .join("\n");
    reply.header("content-type", "text/csv");
    return header + rows;
  });
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
