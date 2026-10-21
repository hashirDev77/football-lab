import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJson, type Health, type Match, type Meta, type Widget } from "../api";
import { DataState, widgetCopy } from "../components/DataState";
import { DataHealth } from "../components/DataHealth";
import { MatchCard } from "../components/MatchCard";
import { StatCompare } from "../components/StatCompare";

const tabs = [
  "overview",
  "timeline",
  "lineups",
  "statistics",
  "players",
  "best-players",
  "h2h",
  "injuries",
  "enrichments",
] as const;

function score(side: Match["score"]["home"]) {
  return side.display || (side.current != null ? String(side.current) : "—");
}

export function MatchPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") || "overview") as (typeof tabs)[number];
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);
  const enrichmentType = params.get("type") || "";

  useEffect(() => {
    setOverview(null);
    getJson(`/app/football/matches/${id}`).then(setOverview).catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (tab === "overview") {
      setPanel(null);
      return;
    }
    setLoadingTab(true);
    const path =
      tab === "timeline"
        ? `/app/football/matches/${id}/timeline`
        : tab === "lineups"
          ? `/app/football/matches/${id}/lineups`
          : tab === "statistics"
            ? `/app/football/matches/${id}/statistics`
            : tab === "players"
              ? `/app/football/matches/${id}/player-statistics`
              : tab === "best-players"
                ? `/app/football/matches/${id}/best-players`
                : tab === "h2h"
                  ? `/app/football/matches/${id}/h2h`
                  : tab === "injuries"
                    ? `/app/football/matches/${id}/injuries`
                    : `/app/football/matches/${id}/enrichments${enrichmentType ? `?type=${encodeURIComponent(enrichmentType)}` : ""}`;
    getJson(path)
      .then(setPanel)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingTab(false));
  }, [id, tab, enrichmentType]);

  const match = (overview?.match || (panel as { match?: Match } | null)?.match) as Match | undefined;

  return (
    <DataState loading={!overview && !error} error={error}>
      {overview && (
        <>
          <div className="header-match card">
            <div className="meta">
              {match?.tournament.id ? (
                <Link to={`/competition/${match.tournament.id}`}>{match.tournament.name}</Link>
              ) : (
                match?.tournament.name || "Competition unavailable"
              )}
              {match?.round ? ` · ${match.round}` : ""}
              {match?.season ? ` · ${match.season}` : ""}
            </div>
            <div className="teams">
              <div>
                <div>
                  {match?.homeTeam.id ? <Link to={`/team/${match.homeTeam.id}`}>{match.homeTeam.name}</Link> : match?.homeTeam.name}
                </div>
                <div className="score">{match ? score(match.score.home) : "—"}</div>
              </div>
              <div className="meta">vs</div>
              <div>
                <div>
                  {match?.awayTeam.id ? <Link to={`/team/${match.awayTeam.id}`}>{match.awayTeam.name}</Link> : match?.awayTeam.name}
                </div>
                <div className="score">{match ? score(match.score.away) : "—"}</div>
              </div>
            </div>
            <div className="meta">
              {match?.status.label === "Live" || match?.status.label === "Halftime" ? <span className="live">{match.status.label}</span> : match?.status.label}{" "}
              {match?.minute != null ? `· ${match.minute}'` : ""} {match?.startTime ? `· ${new Date(match.startTime).toLocaleString()}` : ""}{" "}
              {match?.venue ? `· ${match.venue}` : ""} {match?.referee ? `· ${match.referee}` : ""}
            </div>
          </div>
          <div className="tabs">
            {tabs.map((item) => (
              <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
                {item}
              </button>
            ))}
          </div>
          {tab === "overview" && <Overview overview={overview} />}
          {tab !== "overview" && (
            <DataState loading={loadingTab} error={null}>
              {tab === "timeline" && <Timeline data={panel as never} />}
              {tab === "lineups" && <Lineups data={panel as never} />}
              {tab === "statistics" && <Stats data={panel as never} />}
              {tab === "players" && <PlayerStats data={panel as never} />}
              {tab === "best-players" && <BestPlayers data={panel as never} />}
              {tab === "h2h" && <H2H data={panel as never} />}
              {tab === "injuries" && <Injuries data={panel as never} />}
              {tab === "enrichments" && (
                <Enrichments
                  data={panel as never}
                  onType={(type) => setParams({ tab: "enrichments", type })}
                  selected={enrichmentType}
                />
              )}
            </DataState>
          )}
        </>
      )}
    </DataState>
  );
}

function Overview({ overview }: { overview: Record<string, unknown> }) {
  const match = overview.match as Match | undefined;
  const form = overview.form as Widget;
  const streaks = overview.teamStreaks as Widget;
  const weather = overview.weather as Widget;
  return (
    <div className="grid">
      <div className="panel">
        <h2>Match summary</h2>
        <p>Competition: {match?.tournament.name || "Data unavailable"}</p>
        <p>Round: {match?.round || "Data unavailable"}</p>
        <p>Venue: {match?.venue || "Data unavailable"}</p>
        <p>Referee: {match?.referee || "Data unavailable"}</p>
        <p>Kickoff: {match?.startTime ? new Date(match.startTime).toLocaleString() : "Data unavailable"}</p>
        <p>Status: {match?.status.description || match?.status.label || "Data unavailable"}</p>
        <DataHealth title="Match header" health={overview.health as Health} meta={overview._meta as Meta} endpoint="/event/{eventId}" screen="Match Centre" />
      </div>
      <div className="panel">
        <h2>Pre-game form</h2>
        <p className="empty">{widgetCopy(form?.status, form?.note)}</p>
        {form?.status === "SUPPORTED" && <pre className="meta">{JSON.stringify(form.data, null, 2)}</pre>}
      </div>
      <div className="panel">
        <h2>Team streaks</h2>
        <p className="empty">{widgetCopy(streaks?.status, streaks?.note)}</p>
        {streaks?.status === "SUPPORTED" && <pre className="meta">{JSON.stringify(streaks.data, null, 2)}</pre>}
      </div>
      <div className="panel">
        <h2>Weather</h2>
        <p className="empty">{widgetCopy(weather?.status, weather?.note, "Weather payload was empty — not the same as clear skies.")}</p>
        {weather?.status === "SUPPORTED" && <pre className="meta">{JSON.stringify(weather.data, null, 2)}</pre>}
      </div>
    </div>
  );
}

function Timeline({ data }: { data: { incidents?: Array<Record<string, unknown>>; widget?: Widget; health?: Health; _meta?: Meta } | null }) {
  const incidents = data?.incidents || [];
  return (
    <>
      <DataHealth title="TIMELINE DATA HEALTH" health={data?.health} meta={data?._meta} endpoint="/event/{id}/incidents" screen="Match Centre" />
      {!incidents.length ? (
        <div className="state empty">{widgetCopy(data?.widget?.status, data?.widget?.note) || "No incidents were returned for this match."}</div>
      ) : (
        <div className="timeline panel">
          {incidents.map((item, i) => (
            <div className="item" key={i}>
              <strong>
                {String(item.minute ?? "—")}
                {item.addedTime ? `+${item.addedTime}` : ""}'
              </strong>
              <div>
                {String(item.type || "incident")}{" "}
                {item.playerId ? <Link to={`/player/${item.playerId}`}>{String(item.playerName || "player")}</Link> : String(item.playerName || "")}{" "}
                {item.teamId ? <Link to={`/team/${item.teamId}`}>{String(item.teamName || "")}</Link> : String(item.teamName || "")}
                {item.scoreHome != null ? ` · ${item.scoreHome}-${item.scoreAway}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Lineups({
  data,
}: {
  data: {
    home?: { teamName?: string; formation?: string; managerId?: number; managerName?: string; starters: Array<Record<string, unknown>>; substitutes: Array<Record<string, unknown>> };
    away?: { teamName?: string; formation?: string; managerId?: number; managerName?: string; starters: Array<Record<string, unknown>>; substitutes: Array<Record<string, unknown>> };
    confirmed?: boolean | null;
    widget?: Widget;
    health?: Health;
    _meta?: Meta;
  } | null;
}) {
  if (!data?.home && !data?.away) {
    return <div className="state empty">{widgetCopy(data?.widget?.status, data?.widget?.note) || "Lineups are not available for this match."}</div>;
  }
  return (
    <>
      <p className="meta">Confirmed/expected: {data.confirmed == null ? "Data unavailable" : data.confirmed ? "Confirmed" : "Expected"}</p>
      <DataHealth title="LINEUP DATA HEALTH" health={data.health} meta={data._meta} endpoint="/event/{id}/lineups" screen="Match Centre" />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Side title="Home starting XI" side={data.home} />
        <Side title="Away starting XI" side={data.away} />
      </div>
    </>
  );
}

function Side({
  title,
  side,
}: {
  title: string;
  side?: { teamName?: string; formation?: string; managerId?: number; managerName?: string; starters: Array<Record<string, unknown>>; substitutes: Array<Record<string, unknown>> };
}) {
  if (!side) return <div className="panel empty">{title}: unavailable</div>;
  return (
    <div className="panel">
      <h2>{side.teamName || title}</h2>
      <p className="meta">Formation: {side.formation || "Data unavailable"}</p>
      <p className="meta">
        Coach:{" "}
        {side.managerId ? <Link to={`/manager/${side.managerId}`}>{side.managerName || side.managerId}</Link> : side.managerName || "Data unavailable"}
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Pos</th>
          </tr>
        </thead>
        <tbody>
          {side.starters.map((row, i) => (
            <tr key={i}>
              <td>{String(row.shirtNumber ?? "—")}</td>
              <td>{row.playerId ? <Link to={`/player/${row.playerId}`}>{String(row.name || "—")}</Link> : String(row.name || "—")}</td>
              <td>{String(row.position || "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Substitutes</h3>
      {(side.substitutes || []).length ? (
        (side.substitutes || []).map((row, i) => (
          <div key={i} className="meta">
            {row.playerId ? <Link to={`/player/${row.playerId}`}>{String(row.name)}</Link> : String(row.name || "—")}
          </div>
        ))
      ) : (
        <p className="empty">Substitutes unavailable</p>
      )}
    </div>
  );
}

function Stats({ data }: { data: { rows?: Array<{ name: string; home: string | number | null; away: string | number | null }>; widget?: Widget } | null }) {
  return (
    <>
      <p className="empty">{widgetCopy(data?.widget?.status, data?.widget?.note)}</p>
      <StatCompare rows={data?.rows || []} />
    </>
  );
}

function PlayerStats({ data }: { data: { players?: unknown[]; widget?: Widget } | null }) {
  const players = (data?.players || []) as Array<Record<string, unknown>>;
  if (!players.length) {
    return <div className="state empty">{widgetCopy(data?.widget?.status, data?.widget?.note) || "Player statistics are unavailable."}</div>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Player</th>
          <th>Raw</th>
        </tr>
      </thead>
      <tbody>
        {players.map((row, i) => {
          const player = (row.player || row) as Record<string, unknown>;
          const id = player.id;
          return (
            <tr key={i}>
              <td>{id ? <Link to={`/player/${id}`}>{String(player.name || id)}</Link> : String(player.name || "—")}</td>
              <td className="meta">{JSON.stringify(row.statistics || row)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BestPlayers({ data }: { data: { widget?: Widget; raw?: unknown } | null }) {
  if (data?.widget?.status !== "SUPPORTED") {
    return <div className="state empty">{widgetCopy(data?.widget?.status, data?.widget?.note) || "Best player information is not available."}</div>;
  }
  return (
    <div className="panel">
      <h2>Best players</h2>
      <p className="meta">Ranking rule is not assumed. If the payload does not explain "best", that is a documentation gap.</p>
      <pre className="meta">{JSON.stringify(data.raw, null, 2)}</pre>
    </div>
  );
}

function H2H({ data }: { data: { meetings?: Match[]; teamDuel?: unknown; widget?: Widget } | null }) {
  if (data?.widget?.status !== "SUPPORTED" && !(data?.meetings || []).length) {
    return <div className="state empty">{widgetCopy(data?.widget?.status, data?.widget?.note) || "Head-to-head history is unavailable."}</div>;
  }
  return (
    <>
      <div className="panel">
        <h2>Team duel</h2>
        <pre className="meta">{JSON.stringify(data?.teamDuel, null, 2)}</pre>
      </div>
      <h2>Previous meetings</h2>
      <div className="cards">
        {(data?.meetings || []).map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </>
  );
}

function Injuries({ data }: { data: { items?: unknown[]; availability?: string; widget?: Widget } | null }) {
  const copy =
    data?.availability === "EMPTY"
      ? "The injuries endpoint returned an empty list. That is not the same as 'no injuries'."
      : data?.availability === "UNAVAILABLE"
        ? "Injury information is unavailable for this match."
        : widgetCopy(data?.widget?.status, data?.widget?.note);
  if (!(data?.items || []).length) return <div className="state empty">{copy}</div>;
  return (
    <div className="panel">
      <h2>Injuries</h2>
      <pre className="meta">{JSON.stringify(data?.items, null, 2)}</pre>
    </div>
  );
}

function Enrichments({
  data,
  onType,
  selected,
}: {
  data: { types?: string[]; selected?: { type: string; status: string; raw?: unknown; note?: string }; widget?: Widget } | null;
  onType: (type: string) => void;
  selected: string;
}) {
  const types = data?.types || [];
  return (
    <>
      <p className="empty">{widgetCopy(data?.widget?.status, data?.widget?.note)}</p>
      <div className="tabs">
        {types.map((type) => (
          <button key={type} className={selected === type ? "active" : ""} onClick={() => onType(type)}>
            {type}
          </button>
        ))}
      </div>
      {!types.length && <p className="empty">No enrichment types were advertised. Do not assume odds, news, or predictions exist.</p>}
      {data?.selected && (
        <div className="panel">
          <h2>{data.selected.type}</h2>
          <p className="badge">{data.selected.status}</p>
          <pre className="meta">{JSON.stringify(data.selected.raw, null, 2)}</pre>
        </div>
      )}
    </>
  );
}
