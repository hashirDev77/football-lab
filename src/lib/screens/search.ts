import { FootballClient } from "../raw/client.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { groupSearch, normalizeSearch } from "../normalize/entities.js";

export async function loadSearch(q: string) {
  const ctx = new RequestContext("Search", "results");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);
  ctx.sequential += 1;
  const result = await client.search(q, 1, 20, { screen: "Search", component: "results" });
  const hits = normalizeSearch(result.body);
  const seen = new Set<string>();
  const unique = hits.filter((hit) => {
    const key = `${hit.type}:${hit.id}:${hit.name}`;
    if (seen.has(key)) {
      ctx.recordGap({
        code: "SEARCH_DUPLICATE",
        type: "SCHEMA_INCONSISTENCY",
        severity: "P3",
        endpoint: "/search",
        expected: "unique entity rows",
        actual: `duplicate ${key}`,
        userImpact: "Search shows the same entity twice.",
        developerImpact: "Client must de-duplicate.",
      });
      return false;
    }
    seen.add(key);
    return true;
  });
  for (const hit of unique) {
    if (!hit.id || !hit.name) {
      ctx.recordGap({
        code: "SEARCH_INCOMPLETE",
        type: "MISSING_FIELD",
        severity: "P2",
        endpoint: "/search",
        field: hit.id ? "name" : "id",
        expected: "type, id, name",
        actual: JSON.stringify(hit),
        userImpact: "A search hit cannot be opened.",
        developerImpact: "Normalized search contract is incomplete.",
      });
    }
  }
  if (!unique.length && result.status === 200) {
    ctx.recordGap({
      code: "SEARCH_EMPTY",
      type: "FILTER_INCOMPLETE",
      severity: "P2",
      endpoint: "/search",
      expected: "at least one entity for a common football query",
      actual: `q=${q} total=${result.body?.total ?? 0}`,
      userImpact: "Search returns nothing for a query a football product should handle.",
      developerImpact: "Search quality itself is a coverage gap.",
    });
  }
  return { query: q, ...groupSearch(unique), _meta: { calls: ctx.meta(), gaps: ctx.gaps } };
}
