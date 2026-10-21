import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJson, type Match, type Player, type Widget } from "../api";
import { DataState, widgetCopy } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";
import { DataHealth } from "../components/DataHealth";

const tabs = [
  "overview",
  "squad",
  "matches",
  "performance",
  "rankings",
  "competitions",
  "statistics",
  "media",
  "enrichments",
];

export function TeamPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson(`/app/football/teams/${id}`).then(setOverview).catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (tab === "overview") return;
    const path =
      tab === "matches"
        ? `/app/football/teams/${id}/matches`
        : tab === "squad"
          ? `/app/football/teams/${id}/squad`
          : tab === "performance"
            ? `/app/football/teams/${id}/performance`
            : tab === "rankings"
              ? `/app/football/teams/${id}/rankings`
              : tab === "competitions"
                ? `/app/football/teams/${id}/competitions`
                : tab === "statistics"
                  ? `/app/football/teams/${id}/statistics`
                  : tab === "media"
                    ? `/app/football/teams/${id}/media`
                    : `/app/football/teams/${id}/enrichments`;
    getJson(path).then(setPanel).catch((err: Error) => setError(err.message));
  }, [id, tab]);

  const team = overview?.team as { id: number; name: string; country?: string; managerId?: number; logo?: string } | undefined;
  return (
    <DataState loading={!overview && !error} error={error}>
      {team && (
        <>
          <h1>{team.name}</h1>
          <p className="meta">{team.country || "Country unavailable"}</p>
          <div className="tabs">
            {tabs.map((item) => (
              <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
                {item}
              </button>
            ))}
          </div>
          {tab === "overview" && (
            <div className="grid">
              <div className="panel">
                <h2>Previous match</h2>
                {overview?.previousMatch ? <MatchCard match={overview.previousMatch as Match} /> : <p className="empty">No previous match.</p>}
              </div>
              <div className="panel">
                <h2>Next match</h2>
                {overview?.nextMatch ? <MatchCard match={overview.nextMatch as Match} /> : <p className="empty">No next match.</p>}
              </div>
              <div className="panel">
                <h2>Featured event (compared with near-events, not assumed live)</h2>
                {overview?.featuredEvent ? <MatchCard match={overview.featuredEvent as Match} /> : <p className="empty">No featured event.</p>}
              </div>
              {team.managerId ? (
                <Link className="panel" to={`/manager/${team.managerId}`}>
                  Manager #{String(team.managerId)}
                </Link>
              ) : (
                <div className="panel empty">No manager id on this team payload.</div>
              )}
              <DataHealth title="Team overview" meta={overview?._meta as never} endpoint="/team/{id}" screen="Team" />
            </div>
          )}
          {tab === "matches" && <TeamMatches data={panel as { fixtures?: Match[]; results?: Match[] } | null} />}
          {tab === "squad" && <Squad data={panel as { grouped?: Record<string, Player[]>; widget?: Widget } | null} />}
          {tab === "performance" && <DynamicMetrics data={panel as { metrics?: Array<{ name: string; value: unknown }>; widget?: Widget; raw?: unknown } | null} />}
          {tab === "rankings" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
          {tab === "competitions" && (
            <div className="cards">
              {((panel as { items?: Array<{ id: number; name: string }> } | null)?.items || []).map((item) => (
                <Link className="card" key={item.id} to={`/competition/${item.id}`}>
                  {item.name}
                </Link>
              ))}
            </div>
          )}
          {tab === "statistics" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
          {tab === "media" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
          {tab === "enrichments" && <pre className="panel meta">{JSON.stringify(panel, null, 2)}</pre>}
        </>
      )}
    </DataState>
  );
}

function TeamMatches({ data }: { data: { fixtures?: Match[]; results?: Match[] } | null }) {
  if (!data) return <div className="state">Loading match data...</div>;
  return (
    <>
      <h2>Upcoming</h2>
      <div className="cards">{(data.fixtures || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
      <h2>Previous</h2>
      <div className="cards">{(data.results || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
    </>
  );
}

function Squad({ data }: { data: { grouped?: Record<string, Player[]>; widget?: Widget } | null }) {
  if (!data) return <div className="state">Loading match data...</div>;
  const groups = data.grouped || {};
  const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
  if (!total) return <div className="state empty">{widgetCopy(data.widget?.status, data.widget?.note, "Squad payload was empty — not the same as no players.")}</div>;
  return (
    <>
      {Object.entries(groups).map(([name, players]) => (
        <section className="group" key={name}>
          <h2>{name}</h2>
          <div className="cards">
            {players.map((player) => (
              <Link className="card" key={player.id} to={`/player/${player.id}`}>
                {player.name} <div className="meta">{player.position || "Position unavailable"}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function DynamicMetrics({ data }: { data: { metrics?: Array<{ name: string; value: unknown }>; widget?: Widget; raw?: unknown } | null }) {
  if (!data) return <div className="state">Loading match data...</div>;
  if (data.widget && data.widget.status !== "SUPPORTED") {
    return <div className="state empty">{widgetCopy(data.widget.status, data.widget.note)}</div>;
  }
  return (
    <div className="kpi">
      {(data.metrics || []).map((metric) => (
        <div className="card" key={metric.name}>
          <b>{String(metric.value)}</b>
          <span className="meta">{metric.name}</span>
        </div>
      ))}
      <pre className="panel meta">{JSON.stringify(data.raw, null, 2)}</pre>
    </div>
  );
}

export function TeamsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ id: number; name: string; country?: unknown }>; hasMore?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson(`/app/football/teams?page=${page}`).then(setData).catch((err: Error) => setError(err.message));
  }, [page]);
  return (
    <>
      <h1>Teams</h1>
      <DataState loading={!data && !error} error={error}>
        <div className="cards">
          {(data?.items || []).map((team) => (
            <Link className="card" key={team.id} to={`/team/${team.id}`}>
              <strong>{team.name}</strong>
              <div className="meta">ID {team.id}</div>
            </Link>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <button className="btn ghost" disabled={!data?.hasMore} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </DataState>
    </>
  );
}

export function ManagerPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson(`/app/football/managers/${id}`).then(setData).catch((err: Error) => setError(err.message));
  }, [id]);
  const manager = data?.manager as Record<string, unknown> | undefined;
  return (
    <DataState loading={!data && !error} error={error}>
      <h1>{String(manager?.name || `Manager ${id}`)}</h1>
      <p className="meta">Missing desirable fields: {((data?.missing as string[]) || []).join(", ") || "none recorded"}</p>
      <pre className="panel meta">{JSON.stringify(data, null, 2)}</pre>
    </DataState>
  );
}
