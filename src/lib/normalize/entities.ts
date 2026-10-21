import { asArray, asRecord, unwrapEvent, unwrapList, unwrapPlayer, unwrapTournament } from "../raw/unwrap.js";
import type { Json } from "../raw/types.js";
import type { RequestContext } from "../gaps/context.js";
import { store } from "../gaps/store.js";
import type {
  FootballIncident,
  FootballLineupPlayer,
  FootballLineupSide,
  FootballMatch,
  FootballPlayer,
  FootballScore,
  FootballSeason,
  FootballStanding,
  FootballStatus,
  FootballTeamRef,
  FootballTournament,
  FootballTournamentRef,
  SearchHit,
  StatRow,
} from "./models.js";

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function teamRef(value: unknown): FootballTeamRef {
  const rec = asRecord(value) || {};
  return {
    id: num(rec.id),
    name: str(rec.name) || str(rec.shortName),
    shortName: str(rec.shortName) || str(rec.nameCode),
    country: str(asRecord(rec.country)?.name) || str(rec.country),
    logo: str(rec.logo) || str(rec.image) || str(rec.crest),
  };
}

export function normalizeStatus(raw: unknown, ctx?: RequestContext, endpoint?: string): FootballStatus {
  if (typeof raw === "string") {
    store.addSchemaNote({
      endpoint: endpoint || "list",
      field: "status",
      observed: "string",
      canonical: "object { code, label }",
    });
    ctx?.recordGap({
      code: "SCHEMA_INCONSISTENCY",
      type: "SCHEMA_INCONSISTENCY",
      severity: "P1",
      endpoint: endpoint || "list",
      field: "status",
      expected: "status object { code, description }",
      actual: "string",
      userImpact: "List and detail cannot share one status renderer.",
      developerImpact: "Clients must branch on typeof status.",
      recommendation: "Use a common status object on list and detail.",
    });
    return { code: raw, label: labelForStatus(raw), description: raw };
  }
  const rec = asRecord(raw) || {};
  const code = str(rec.code) || str(rec.type) || str(rec.description) || "unknown";
  const description = str(rec.description);
  return { code, label: labelForStatus(code, description), description };
}

function labelForStatus(code: string, description?: string | null): string {
  const value = `${code} ${description || ""}`.toLowerCase();
  if (value.includes("halftime") || value.includes("ht") || value.includes("pause")) return "Halftime";
  if (
    value.includes("inprogress") ||
    value.includes("live") ||
    value.includes("1st") ||
    value.includes("2nd") ||
    value.includes("extra") ||
    value.includes("penalt") ||
    ["6", "7", "31", "32", "40", "41", "42"].includes(code)
  ) {
    return "Live";
  }
  if (value.includes("notstarted") || value.includes("upcoming") || code === "0") return "Upcoming";
  if (value.includes("finished") || value.includes("complete") || value.includes("ended") || ["100", "110"].includes(code)) {
    return "Completed";
  }
  if (value.includes("cancel")) return "Cancelled";
  if (value.includes("postpon")) return "Postponed";
  return description || code;
}

export function normalizeTimestamp(raw: unknown, ctx?: RequestContext, endpoint?: string): string | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    store.addSchemaNote({
      endpoint: endpoint || "list",
      field: "startTimestamp",
      observed: "integer unix seconds",
      canonical: "ISO-8601 string",
    });
    ctx?.recordGap({
      code: "SCHEMA_INCONSISTENCY",
      type: "SCHEMA_INCONSISTENCY",
      severity: "P1",
      endpoint: endpoint || "list",
      field: "startTimestamp",
      expected: "ISO-8601 string",
      actual: "integer unix seconds",
      userImpact: "Start times render inconsistently across screens.",
      developerImpact: "List and detail use different timestamp types.",
      recommendation: "Use one UTC representation on every event payload.",
    });
    return new Date(raw * 1000).toISOString();
  }
  const text = String(raw);
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    if (seconds > 1e9) return new Date(seconds * 1000).toISOString();
  }
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return text;
}

function scoreFromBlock(block: unknown, source: FootballScore["source"]): FootballScore {
  const rec = asRecord(block) || {};
  const current = num(rec.current) ?? num(rec.display) ?? num(rec.score);
  const display = current != null ? String(current) : str(rec.display);
  return {
    current,
    display,
    ht: num(rec.period1) ?? num(rec.ht),
    et: num(rec.extra) ?? num(rec.extraTime) ?? num(rec.period3),
    penalties: num(rec.penalties) ?? num(rec.period5),
    source: current == null && display == null ? "missing" : source,
  };
}

export function hasScore(score: FootballScore): boolean {
  return score.current != null || (score.display != null && score.source !== "missing");
}

export function normalizeMatch(raw: unknown, ctx?: RequestContext, source: "list" | "event" = "event"): FootballMatch | null {
  const rec = asRecord(raw) || unwrapEvent(asRecord(raw));
  if (!rec || rec.id == null) return null;
  const tournamentRaw = asRecord(rec.uniqueTournament) || asRecord(rec.tournament);
  const tournament: FootballTournamentRef = {
    id: num(tournamentRaw?.id) ?? num(rec.tournamentId) ?? num(rec.uniqueTournamentId),
    name: str(tournamentRaw?.name) || str(rec.tournamentName),
  };
  if (source === "event" && tournamentRaw && tournamentRaw.id == null && rec.tournamentId == null) {
    ctx?.recordGap({
      code: "BROKEN_RELATIONSHIP",
      type: "BROKEN_RELATIONSHIP",
      severity: "P1",
      endpoint: "/event/{id}",
      field: "uniqueTournament.id",
      expected: "numeric tournament id",
      actual: "null",
      fallback: "list tournamentId if previously seen",
      userImpact: "Cannot reliably navigate match → competition.",
      developerImpact: "Detail drops the id that list already provided.",
      recommendation: "Always set uniqueTournament.id when a name is present.",
    });
  }
  const home = scoreFromBlock(rec.homeScore, source);
  const away = scoreFromBlock(rec.awayScore, source);
  const status = normalizeStatus(rec.status ?? rec.statusType, ctx, source === "list" ? "/events" : "/event/{id}");
  const startTime = normalizeTimestamp(rec.startTimestamp ?? rec.startTime, ctx, source === "list" ? "/events" : "/event/{id}");
  const round = asRecord(rec.roundInfo);
  const season = asRecord(rec.season);
  const referee = asRecord(rec.referee);
  return {
    id: Number(rec.id),
    status,
    startTime,
    minute: num(rec.currentPeriodStartTimestamp) ? null : num(asRecord(rec.status)?.periodLength) ?? num(rec.time) ?? num(rec.minute),
    tournament,
    round: str(round?.name) || (round?.round != null ? `Round ${round.round}` : null),
    season: str(season?.name) || str(season?.year),
    homeTeam: teamRef(rec.homeTeam),
    awayTeam: teamRef(rec.awayTeam),
    score: { home, away },
    venue: str(asRecord(rec.venue)?.name) || str(asRecord(asRecord(rec.venue)?.stadium)?.name) || str(rec.venue),
    referee: str(referee?.name),
    result: str(rec.winnerCode) || str(rec.note) || (status.label === "Completed" ? status.description ?? null : null),
  };
}

export function normalizeMatches(body: Json | null, ctx?: RequestContext, source: "list" | "event" = "list"): FootballMatch[] {
  return unwrapList(body)
    .map((item) => normalizeMatch(item, ctx, source))
    .filter((item): item is FootballMatch => Boolean(item));
}

export function normalizePlayer(raw: unknown): FootballPlayer | null {
  const rec = asRecord(raw) || unwrapPlayer(asRecord(raw));
  if (!rec || rec.id == null) return null;
  const team = asRecord(rec.team) || asRecord(rec.currentTeam);
  const birth = rec.dateOfBirthTimestamp ?? rec.dateOfBirth;
  return {
    id: Number(rec.id),
    name: str(rec.name) || [str(rec.firstName), str(rec.lastName)].filter(Boolean).join(" ") || null,
    team: team ? teamRef(team) : null,
    country: str(asRecord(rec.country)?.name) || str(rec.country) || str(rec.nationality),
    position: str(rec.position) || str(rec.role) || str(asRecord(rec.playerTeamInfo)?.position),
    shirtNumber: num(rec.jerseyNumber) ?? num(rec.shirtNumber) ?? num(asRecord(rec.playerTeamInfo)?.jerseyNumber),
    age: num(rec.age),
    dateOfBirth: typeof birth === "number" ? new Date(birth * 1000).toISOString().slice(0, 10) : str(birth),
    height: num(rec.height),
    image: str(rec.image) || str(rec.photo) || str(rec.logo),
  };
}

export function normalizeTournament(raw: unknown): FootballTournament | null {
  const rec = asRecord(raw) || unwrapTournament(asRecord(raw));
  if (!rec || rec.id == null) return null;
  return {
    id: Number(rec.id),
    name: str(rec.name),
    country: str(asRecord(rec.category)?.name) || str(asRecord(rec.country)?.name) || str(rec.country),
    category: str(asRecord(rec.category)?.name) || str(rec.category),
    logo: str(rec.logo) || str(rec.image),
    currentSeasonId: num(asRecord(rec.currentSeason)?.id) ?? num(rec.currentSeasonId),
    active: typeof rec.active === "boolean" ? rec.active : null,
  };
}

export function normalizeSeason(raw: unknown): FootballSeason | null {
  const rec = asRecord(raw);
  if (!rec || rec.id == null) return null;
  return { id: Number(rec.id), name: str(rec.name) || str(rec.year), year: str(rec.year) || str(rec.name) };
}

export function normalizeIncident(raw: unknown): FootballIncident {
  const rec = asRecord(raw) || {};
  const player = asRecord(rec.player) || asRecord(rec.playerIn);
  const assist = asRecord(rec.assist1) || asRecord(rec.assist);
  const team = asRecord(rec.team);
  return {
    type: str(rec.incidentType) || str(rec.type) || str(rec.incidentClass),
    minute: num(rec.time) ?? num(rec.minute),
    addedTime: num(rec.addedTime) ?? num(rec.injuryTime),
    playerId: num(player?.id) ?? num(rec.playerId),
    playerName: str(player?.name) || str(rec.playerName),
    assistId: num(assist?.id),
    assistName: str(assist?.name),
    teamId: num(team?.id) ?? num(rec.teamId),
    teamName: str(team?.name),
    isHome: typeof rec.isHome === "boolean" ? rec.isHome : null,
    scoreHome: num(asRecord(rec.homeScore)?.current) ?? num(rec.homeScore),
    scoreAway: num(asRecord(rec.awayScore)?.current) ?? num(rec.awayScore),
    raw: rec,
  };
}

function lineupPlayer(raw: unknown, substitute: boolean): FootballLineupPlayer {
  const rec = asRecord(raw) || {};
  const player = asRecord(rec.player) || rec;
  return {
    playerId: num(player.id) ?? num(rec.playerId),
    name: str(player.name) || str(rec.name),
    position: str(rec.position) || str(player.position),
    shirtNumber: num(rec.jerseyNumber) ?? num(rec.shirtNumber) ?? num(player.jerseyNumber),
    substitute,
    captain: typeof rec.captain === "boolean" ? rec.captain : null,
    rating: num(rec.rating) ?? num(asRecord(rec.statistics)?.rating),
  };
}

export function normalizeLineupSide(raw: unknown): FootballLineupSide | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const players = asArray(rec.players);
  const starters = players.filter((row) => {
    const item = asRecord(row) || {};
    return item.substitute !== true && str(item.position) !== "SUB";
  });
  const substitutes = players.filter((row) => {
    const item = asRecord(row) || {};
    return item.substitute === true || str(item.position) === "SUB";
  });
  const manager = asRecord(rec.manager);
  return {
    teamId: num(asRecord(rec.team)?.id) ?? num(rec.teamId),
    teamName: str(asRecord(rec.team)?.name),
    formation: str(rec.formation),
    managerId: num(manager?.id),
    managerName: str(manager?.name),
    starters: (starters.length ? starters : players.slice(0, 11)).map((row) => lineupPlayer(row, false)),
    substitutes: (substitutes.length ? substitutes : players.slice(11)).map((row) => lineupPlayer(row, true)),
  };
}

export function normalizeStandings(body: Json | null): FootballStanding[] {
  const standings = asArray(body?.standings);
  const rows = standings.flatMap((group) => asArray(asRecord(group)?.rows));
  return rows.map((row) => {
    const rec = asRecord(row) || {};
    return {
      position: num(rec.position) ?? num(rec.rank),
      team: teamRef(rec.team),
      played: num(rec.matches) ?? num(rec.played) ?? num(rec.p),
      won: num(rec.wins) ?? num(rec.won) ?? num(rec.w),
      drawn: num(rec.draws) ?? num(rec.drawn) ?? num(rec.d),
      lost: num(rec.losses) ?? num(rec.lost) ?? num(rec.l),
      goalsFor: num(rec.scoresFor) ?? num(rec.goalsFor) ?? num(rec.gf),
      goalsAgainst: num(rec.scoresAgainst) ?? num(rec.goalsAgainst) ?? num(rec.ga),
      goalDifference: num(rec.goalDifference) ?? num(rec.gd),
      points: num(rec.points) ?? num(rec.pts),
      form: str(rec.form) || (Array.isArray(rec.streak) ? rec.streak.join("") : null),
      raw: rec,
    };
  });
}

export function normalizeStatistics(body: Json | null): StatRow[] {
  const groups = asArray(body?.statistics).length ? asArray(body?.statistics) : asArray(asRecord(body)?.groups);
  const rows: StatRow[] = [];
  const walk = (items: unknown[]) => {
    for (const item of items) {
      const rec = asRecord(item) || {};
      if (Array.isArray(rec.statisticsGroups) || Array.isArray(rec.groups) || Array.isArray(rec.statisticsItems) || Array.isArray(rec.items)) {
        walk(asArray(rec.statisticsGroups || rec.groups || rec.statisticsItems || rec.items));
        continue;
      }
      const name = str(rec.name) || str(rec.key) || str(rec.type);
      if (!name) continue;
      rows.push({
        name,
        home: (rec.home ?? rec.homeValue ?? rec.valueHome ?? null) as string | number | null,
        away: (rec.away ?? rec.awayValue ?? rec.valueAway ?? null) as string | number | null,
      });
    }
  };
  walk(groups.length ? groups : asArray(body?.items));
  if (!rows.length) {
    const period = asRecord(asArray(body?.statistics)[0]);
    walk(asArray(period?.groups));
  }
  return rows;
}

export function normalizeSearch(body: Json | null): SearchHit[] {
  return unwrapList(body).map((row) => {
    const rec = asRecord(row) || {};
    const rawType = str(rec.type) || str(rec.entityType) || "";
    const type =
      rawType.toLowerCase().includes("player")
        ? "player"
        : rawType.toLowerCase().includes("team")
          ? "team"
          : rawType.toLowerCase().includes("tournament")
            ? "tournament"
            : "unknown";
    return {
      type,
      id: num(rec.id),
      name: str(rec.name),
      image: str(rec.image) || str(rec.logo),
      country: str(asRecord(rec.country)?.name) || str(rec.country),
      team: str(asRecord(rec.team)?.name),
      competition: str(asRecord(rec.uniqueTournament)?.name),
    };
  });
}

export function groupSearch(hits: SearchHit[]) {
  return {
    players: hits.filter((hit) => hit.type === "player"),
    teams: hits.filter((hit) => hit.type === "team"),
    competitions: hits.filter((hit) => hit.type === "tournament"),
    other: hits.filter((hit) => hit.type === "unknown"),
  };
}

export function positionGroup(position: string | null): "goalkeepers" | "defenders" | "midfielders" | "forwards" | "unknown" {
  const value = (position || "").toLowerCase();
  if (value.startsWith("g") || value.includes("keep") || value === "gk") return "goalkeepers";
  if (value.startsWith("d") || value.includes("back") || value.includes("def")) return "defenders";
  if (value.startsWith("m") || value.includes("mid")) return "midfielders";
  if (value.startsWith("f") || value.includes("forward") || value.includes("wing") || value.includes("striker") || value === "st") {
    return "forwards";
  }
  return "unknown";
}

export function classify(value: unknown, derived = false): "AVAILABLE" | "DERIVED" | "MISSING" | "NULL" {
  if (derived && value != null) return "DERIVED";
  if (value === undefined) return "MISSING";
  if (value === null) return "NULL";
  return "AVAILABLE";
}

export { num, str };
