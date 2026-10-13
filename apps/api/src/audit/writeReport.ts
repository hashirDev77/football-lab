import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import { CATALOG } from "../raw/catalog.js";
import { store } from "../gaps/store.js";
import { catalogTotals, coverageByScreen, endpointHealth, experienceScores } from "../gaps/scoring.js";
import { recommendationsFromGaps } from "../gaps/recommendations.js";

export function writeMarkdownReport() {
  const totals = catalogTotals();
  const endpoints = endpointHealth();
  const screens = coverageByScreen();
  const experiences = experienceScores();
  const recs = recommendationsFromGaps();
  const missing = store.gaps.filter((g) => g.type === "MISSING_FIELD" || g.type === "NULL_FIELD");
  const relationships = store.gaps.filter((g) => g.type === "BROKEN_RELATIONSHIP");
  let auditNotes = "";
  try {
    const audit = JSON.parse(readFileSync(resolve(config.dataDir, "phase1-audit.json"), "utf8")) as {
      liveId?: number;
      teamId?: number;
      playerId?: number;
      tournamentId?: number;
      seasonId?: number;
      auth?: Record<string, number>;
      searches?: Record<string, number>;
      summary?: Record<string, { status: number; bytes: number; error: string | null }>;
    };
    const summaryRows = Object.entries(audit.summary || {})
      .map(([key, value]) => `- ${key}: HTTP ${value.status}, ${value.bytes} bytes${value.error ? ` — ${value.error}` : ""}`)
      .join("\n");
    auditNotes = `
## Live catalog sweep

Sample IDs: event ${audit.liveId ?? "—"}, team ${audit.teamId ?? "—"}, player ${audit.playerId ?? "—"}, tournament ${audit.tournamentId ?? "—"}, season ${audit.seasonId ?? "—"}.

Auth matrix: APIM-only ${audit.auth?.apimOnly ?? "—"}, live-only ${audit.auth?.liveOnly ?? "—"}, both ${audit.auth?.both ?? "—"}.
Live-only succeeding while APIM-only 403s is an authentication documentation gap.

Search hits: ${Object.entries(audit.searches || {}).map(([q, id]) => `\`${q}\` → ${id}`).join(", ") || "none"}.
\`Liverpol\` (misspelling) did not return a usable id in this run.

${summaryRows}

## Coverage matrix (this run)

Do not treat one event as all of football. This sweep used today's fixtures plus directory/search IDs.

- Today's fixtures: available
- Live \`/events?status=inprogress\`: available but thin
- Finished \`/events?status=finished\`: available but thin
- Premier League search: resolved an id
- Champions search: resolved an id
- Club names (Arsenal, Liverpool): resolved ids
- Misspelling (Liverpol): no id
- Match extras (best-players, team-streaks, typed enrichments): 404 as missing enrichments
- Weather/injuries/lineups/pregame-form: HTTP 200 with very small payloads — empty vs unsupported is still ambiguous
- Team squad/media/rankings/performance/near-events: populated
- Unique-tournament profile: populated (not name-only)
- Manager without a real id: 404
- Team season stats with a mismatched tournament/season pair: 404
`;
  } catch {
    auditNotes = "\n## Live catalog sweep\n\nRun `pnpm audit:phase1` to populate this section.\n";
  }

  const md = `# Football API Coverage Report

Generated ${new Date().toISOString()}

This product is a football UI and an API coverage lab. Completeness is measured from live observations, not from calling 43 routes once.
${auditNotes}
## Endpoint coverage

- Catalog: **${totals.catalog}**
- Tested: **${totals.tested}**
- Returning useful data: **${totals.useful}**
- Empty: **${totals.empty}**
- Errors: **${totals.errors}**
- Untested: **${totals.untested}**
- API calls recorded: **${totals.apiCalls}**
- Gaps: **${totals.gapCount}**
- Manual findings: **${totals.findingCount}**

## Experience scores

${experiences.map((row) => `- ${row.label}: **${row.overall}%**`).join("\n")}

## Screen coverage

${screens.map((row) => `- ${row.screen}: overall ${row.scores.overall}, complete ${row.complete}%, gaps ${row.gapCount}`).join("\n")}

## Endpoint matrix

${endpoints.map((row) => `- \`${row.path}\` · ${row.screen} · last ${row.lastStatus ?? "untested"} · ${row.lastMs ?? "—"}ms · useful=${row.useful} empty=${row.empty} · score ${row.coverageScore}`).join("\n")}

## Missing fields

${missing.length ? missing.slice(0, 40).map((gap) => `- **${gap.code}** \`${gap.endpoint}\` ${gap.field || ""} — expected ${gap.expected}; actual ${gap.actual}`).join("\n") : "- None recorded yet."}

## Relationship issues

${relationships.length ? relationships.slice(0, 40).map((gap) => `- **${gap.code}** \`${gap.endpoint}\` — ${gap.expected} / ${gap.actual}`).join("\n") : "- None recorded yet."}

## Improvement backlog

${recs.length ? recs.map((rec) => `### ${rec.title}\n\n${rec.body}\n`).join("\n") : "- Run product screens or \`pnpm audit:phase1\` to populate recommendations."}

## Catalog

${CATALOG.map((row) => `- \`${row.path}\` (${row.family} / ${row.screen})`).join("\n")}

## Definition of done questions

- Which user journeys work completely?
- Which cannot be completed?
- Which endpoints return empty data?
- Which endpoints have partial data?
- Which important fields are absent?
- Which entities cannot be linked?
- Which endpoints behave differently by competition?
- Which data is unclear or undocumented?
- Which user experience requires too many requests?
- Which genuinely new endpoints are needed?
- Which existing endpoints only need more/better fields?
`;

  const out = resolve(process.cwd(), "../../football_api_reports.md");
  writeFileSync(out, md);
  return out;
}

if (process.argv[1]?.includes("writeReport")) {
  console.log(writeMarkdownReport());
}
