import { FootballClient } from "../raw/client.js";
import { RequestContext, withClient } from "../gaps/context.js";
import { normalizeMatches } from "../normalize/entities.js";

export async function loadMatches(opts?: { tab?: string; tournamentId?: number; status?: string }) {
  const tab = opts?.tab;
  const ctx = new RequestContext("Matches", tab || "list");
  ctx.minimum = 1;
  const client = new FootballClient(withClient(ctx).onCall);

  const status =
    opts?.status ||
    (tab === "live" ? "inprogress" : tab === "results" ? "finished" : tab === "upcoming" ? "notstarted" : undefined);

  ctx.sequential += 1;
  const [events, fixtures] = await Promise.all([
    client.events(
      { status, limit: 40, tournamentId: opts?.tournamentId },
      { screen: "Matches", component: tab || "list" },
    ),
    tab === "today" || !tab
      ? client.fixturesToday(undefined, undefined, { screen: "Matches", component: "today" })
      : Promise.resolve(null),
  ]);
  ctx.parallel += fixtures ? 2 : 1;

  const list = normalizeMatches(events.body, ctx, "list");
  const today = fixtures ? normalizeMatches(fixtures.body, ctx, "list") : [];

  if ((tab === "results" || status === "finished") && list.length === 0) {
    ctx.recordGap({
      code: "EVENT_FINISHED_FILTER_INCOMPLETE",
      type: "FILTER_INCOMPLETE",
      severity: "P2",
      endpoint: "/events?status=finished",
      expected: "completed matches when they exist elsewhere",
      actual: `total=${(events.body?.total as number | undefined) ?? list.length}`,
      userImpact: "Results tab can appear empty while finished matches exist on team pages.",
      developerImpact: "Cannot trust the finished filter for a Results page.",
      recommendation: "Include recent completed events in /events?status=finished.",
    });
  }

  if (opts?.tournamentId && !events.params?.tournamentId) {
    ctx.recordGap({
      code: "FILTER_INCOMPLETE",
      type: "FILTER_INCOMPLETE",
      severity: "P2",
      endpoint: "/events",
      expected: "tournamentId query support",
      actual: "unable to confirm competition filter",
      userImpact: "Cannot show today's Premier League games from the list endpoint without client filtering.",
      developerImpact: "Client-side workarounds for common discovery jobs.",
    });
  }

  return {
    live: tab === "live" ? list : list.filter((match) => match.status.label === "Live" || match.status.label === "Halftime"),
    today: today.length ? today : list,
    upcoming: list.filter((match) => match.status.label === "Upcoming"),
    results: tab === "results" ? list : list.filter((match) => match.status.label === "Completed"),
    rawTotal: events.body?.total ?? null,
    tournamentId: opts?.tournamentId ?? null,
    _meta: { calls: ctx.meta(), gaps: ctx.gaps },
  };
}
