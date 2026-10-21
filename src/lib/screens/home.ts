import { FootballClient } from "../raw/client.js";
import { unwrapEvent, unwrapList } from "../raw/unwrap.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { HOME_CARD, evaluateContract, isLive } from "../contracts/index.js";
import { hasScore, normalizeMatch, normalizeMatches, normalizeTournament } from "../normalize/entities.js";
import type { FootballMatch } from "../normalize/models.js";

function bucket(matches: FootballMatch[]) {
  const live: FootballMatch[] = [];
  const today: FootballMatch[] = [];
  const upcoming: FootballMatch[] = [];
  const completed: FootballMatch[] = [];
  for (const match of matches) {
    today.push(match);
    if (isLive(match)) live.push(match);
    else if (match.status.label === "Completed") completed.push(match);
    else upcoming.push(match);
  }
  return { live, today, upcoming, completed };
}

export async function loadHome() {
  const ctx = new RequestContext("Home", "Live match card");
  ctx.minimum = 3;
  const client = new FootballClient(withClient(ctx).onCall);

  ctx.sequential += 1;
  const [fixtures, liveFeed, tournaments] = await Promise.all([
    client.fixturesToday(undefined, undefined, { screen: "Home", component: "Today list" }),
    client.events({ status: "inprogress", limit: 20 }, { screen: "Home", component: "Live feed" }),
    client.tournaments(1, 12, { screen: "Home", component: "Featured competitions" }),
  ]);
  ctx.parallel += 3;

  const fromFixtures = normalizeMatches(fixtures.body, ctx, "list");
  const fromLive = normalizeMatches(liveFeed.body, ctx, "list");
  const byId = new Map<number, FootballMatch>();
  for (const match of [...fromFixtures, ...fromLive]) byId.set(match.id, match);

  const needEnrichment = [...byId.values()].filter(
    (match) => isLive(match) && !hasScore(match.score.home) && !hasScore(match.score.away),
  );
  if (needEnrichment.length) {
    ctx.recordGap({
      code: "HOME_MATCH_SCORE_MISSING",
      type: "EXTRA_REQUEST_REQUIRED",
      severity: "P1",
      endpoint: "/fixtures/today",
      expected: "score available for live match cards",
      actual: "fixture returned no score",
      fallback: "/event/{eventId}",
      extraCalls: needEnrichment.length,
      userImpact: "Live cards cannot display the current match score from the list response.",
      developerImpact: "N+1 event-detail requests.",
      recommendation: "Include a compact score object in fixture list response.",
    });
  }

  ctx.sequential += 1;
  const details = await Promise.all(
    needEnrichment.slice(0, 8).map((match) =>
      client.event(match.id, {
        screen: "Home",
        component: "Live match card",
        fallback: true,
        fallbackEndpoint: `/event/${match.id}`,
      }),
    ),
  );
  ctx.parallel += details.length;

  for (const detail of details) {
    const normalized = normalizeMatch(unwrapEvent(detail.body) || detail.body, ctx, "event");
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    if (existing && existing.tournament.id && !normalized.tournament.id) {
      ctx.recordGap({
        code: "BROKEN_RELATIONSHIP",
        type: "BROKEN_RELATIONSHIP",
        severity: "P1",
        endpoint: "/event/{id}",
        field: "uniqueTournament.id",
        expected: "tournament id from list",
        actual: "null on detail",
        fallback: "fixture tournamentId",
        userImpact: "Cannot reliably navigate match → competition.",
        developerImpact: "Must cache list tournamentId to keep the relationship.",
      });
    }
    byId.set(normalized.id, {
      ...existing,
      ...normalized,
      tournament: {
        id: normalized.tournament.id ?? existing?.tournament.id ?? null,
        name: normalized.tournament.name ?? existing?.tournament.name ?? null,
      },
    });
  }

  for (const match of byId.values()) {
    evaluateContract(
      ctx,
      "/fixtures/today",
      "Live match card",
      {
        id: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        status: match.status.code,
        startTime: match.startTime,
        score: hasScore(match.score.home) || hasScore(match.score.away) ? match.score : null,
        tournament: match.tournament.name,
        venue: match.venue,
        minute: match.minute,
      },
      HOME_CARD,
      isLive(match),
    );
  }

  const grouped = bucket([...byId.values()]);
  const competitions = unwrapList(tournaments.body)
    .map(normalizeTournament)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    ...grouped,
    competitions,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}
