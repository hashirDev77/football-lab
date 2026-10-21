import { store } from "./store.js";

export function recommendationsFromGaps() {
  const recs: Array<{ title: string; body: string; basedOn: string[] }> = [];
  const codes = new Set(store.gaps.map((gap) => gap.code));

  if (codes.has("HOME_MATCH_SCORE_MISSING")) {
    recs.push({
      title: "Improve /fixtures/today",
      body: "Add score, minute, and status on list rows so a live home card does not require N+1 event-detail calls.",
      basedOn: ["HOME_MATCH_SCORE_MISSING"],
    });
  }
  if (codes.has("SCHEMA_INCONSISTENCY") || store.schemaNotes.length) {
    recs.push({
      title: "Normalize /events and /event/{id}",
      body: "Use one status object and one timestamp type across list and detail payloads.",
      basedOn: ["SCHEMA_INCONSISTENCY"],
    });
  }
  if (codes.has("BROKEN_RELATIONSHIP")) {
    recs.push({
      title: "Always emit entity IDs on nested objects",
      body: "Match → team → player → competition navigation fails when names exist without usable IDs.",
      basedOn: ["BROKEN_RELATIONSHIP"],
    });
  }
  if (codes.has("OPTIONAL_404")) {
    recs.push({
      title: "Return empty 200 for optional extras",
      body: "best-players, team-streaks, weather, injuries, and enrichment types should not 404 on a valid match.",
      basedOn: ["OPTIONAL_404"],
    });
  }
  if (codes.has("PLAYER_SEASON_STATS_COVERAGE")) {
    recs.push({
      title: "Document player season-stat coverage",
      body: "The same tournament/season can return 200 for one squad member and 404 for another. Publish coverage or a dedicated /player/{id}/statistics route.",
      basedOn: ["PLAYER_SEASON_STATS_COVERAGE"],
    });
  }
  if (codes.has("EVENT_FINISHED_FILTER_INCOMPLETE")) {
    recs.push({
      title: "Fix /events?status=finished",
      body: "Completed matches exist on other endpoints while the finished filter returns total=0.",
      basedOn: ["EVENT_FINISHED_FILTER_INCOMPLETE"],
    });
  }
  if (codes.has("FEATURED_EVENT_SEMANTICS_UNCLEAR")) {
    recs.push({
      title: "Document featured-event as editorial",
      body: "Do not treat featured-event as the current live match. Point live UX at near-events or global live events.",
      basedOn: ["FEATURED_EVENT_SEMANTICS_UNCLEAR"],
    });
  }
  if (codes.has("AUTHENTICATION_GAP")) {
    recs.push({
      title: "Publish one auth contract",
      body: "APIM-only can 403 while live-key-only succeeds. Document the required headers for Football.",
      basedOn: ["AUTHENTICATION_GAP"],
    });
  }
  if (codes.has("LINEUP_INCOMPLETE")) {
    recs.push({
      title: "Complete lineup payloads",
      body: "Starting XI should include player IDs, positions, shirt numbers, formation, and a confirmed/expected flag.",
      basedOn: ["LINEUP_INCOMPLETE"],
    });
  }
  if (codes.has("INCIDENT_MISSING_IDS")) {
    recs.push({
      title: "Attach playerId and teamId on incidents",
      body: "A timeline that only has names cannot open player or team profiles.",
      basedOn: ["INCIDENT_MISSING_IDS"],
    });
  }
  if (codes.has("RANKING_SCOPE_UNCLEAR")) {
    recs.push({
      title: "Document ranking scope",
      body: "Team rankings need a competition, region, or world context so the UI is not guessing.",
      basedOn: ["RANKING_SCOPE_UNCLEAR"],
    });
  }
  if (codes.has("BEST_PLAYERS_SEMANTICS_UNCLEAR")) {
    recs.push({
      title: "Document how best-players is ranked",
      body: "If rating, goals, or editorial selection is the rule, say so. Do not leave clients to guess.",
      basedOn: ["BEST_PLAYERS_SEMANTICS_UNCLEAR"],
    });
  }
  return recs;
}
