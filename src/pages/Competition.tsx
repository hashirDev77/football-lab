import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJson, type Match } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";
import { DataHealth } from "../components/DataHealth";

export function CompetitionPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [seasonId, setSeasonId] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [round, setRound] = useState("1");
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const standingType = params.get("type") || "total";

  useEffect(() => {
    getJson(`/app/football/competitions/${id}`)
      .then((data) => {
        setOverview(data);
        const current = String((data as { currentSeasonId?: number }).currentSeasonId || "");
        setSeasonId(current);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (tab === "overview") return;
    if (tab === "fixtures") getJson(`/app/football/competitions/${id}/matches`).then(setPanel).catch((err: Error) => setError(err.message));
    if (tab === "calendar") getJson(`/app/football/competitions/${id}/matches?date=${date}`).then(setPanel).catch((err: Error) => setError(err.message));
    if (tab === "seasons") getJson(`/app/football/competitions/${id}/seasons`).then(setPanel).catch((err: Error) => setError(err.message));
    if (tab === "standings" && seasonId) {
      getJson(`/app/football/competitions/${id}/standings?seasonId=${seasonId}&type=${standingType}`).then(setPanel).catch((err: Error) => setError(err.message));
    }
    if (tab === "rounds" && seasonId) {
      getJson(`/app/football/competitions/${id}/round?seasonId=${seasonId}&round=${round}`).then(setPanel).catch((err: Error) => setError(err.message));
    }
  }, [id, tab, seasonId, date, round, standingType]);

  const tournament = overview?.tournament as { name?: string; country?: string; category?: string } | undefined;
  const seasons = (overview?.seasons || []) as Array<{ id: number; name: string }>;

  function shiftDate(days: number) {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);
    setDate(next.toISOString().slice(0, 10));
  }

  return (
    <DataState loading={!overview && !error} error={error}>
      <h1>{tournament?.name || "Competition"}</h1>
      <p className="meta">
        {tournament?.country || "Region unavailable"} · {tournament?.category || "Category unavailable"}
      </p>
      <label className="meta">
        Season{" "}
        <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      </label>
      <div className="tabs">
        {["overview", "fixtures", "calendar", "standings", "rounds", "seasons"].map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
            {item}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <DataHealth title="Competition overview" meta={overview?._meta as never} endpoint="/unique-tournament/{id}" screen="Competition" />
          <div className="cards">
            {((overview?.matches || []) as Match[]).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </>
      )}
      {tab === "fixtures" && <FixtureGroups data={panel as { live?: Match[]; upcoming?: Match[]; completed?: Match[]; days?: Array<{ date: string; matches: Match[] }> } | null} />}
      {tab === "calendar" && (
        <>
          <div className="row">
            <button className="btn ghost" onClick={() => shiftDate(-1)}>
              Previous day
            </button>
            <strong>{date}</strong>
            <button className="btn ghost" onClick={() => shiftDate(1)}>
              Next day
            </button>
          </div>
          <FixtureGroups data={panel as never} />
        </>
      )}
      {tab === "standings" && (
        <>
          <div className="tabs">
            {["total", "home", "away"].map((item) => (
              <button key={item} className={standingType === item ? "active" : ""} onClick={() => setParams({ tab: "standings", type: item })}>
                {item}
              </button>
            ))}
          </div>
          <Standings data={panel as { columns?: string[]; rows?: Array<Record<string, unknown>> } | null} />
        </>
      )}
      {tab === "rounds" && (
        <>
          <label className="meta">
            Round <input className="field" value={round} onChange={(e) => setRound(e.target.value)} />
          </label>
          <div className="cards">
            {((panel as { matches?: Match[] } | null)?.matches || []).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </>
      )}
      {tab === "seasons" && (
        <div className="cards">
          {((panel as { seasons?: Array<{ id: number; name: string }> } | null)?.seasons || seasons).map((season) => (
            <div className="card" key={season.id}>
              {season.name} · {season.id}
            </div>
          ))}
        </div>
      )}
    </DataState>
  );
}

function FixtureGroups({
  data,
}: {
  data: { live?: Match[]; upcoming?: Match[]; completed?: Match[]; days?: Array<{ date: string; matches: Match[] }> } | null;
}) {
  if (!data) return <div className="state">Loading match data...</div>;
  if (data.days?.length) {
    return (
      <>
        {data.days.map((day) => (
          <section className="group" key={day.date}>
            <h2>{day.date}</h2>
            <div className="cards">
              {day.matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        ))}
      </>
    );
  }
  return (
    <>
      <h2>Live</h2>
      <div className="cards">{(data.live || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
      <h2>Upcoming</h2>
      <div className="cards">{(data.upcoming || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
      <h2>Completed</h2>
      <div className="cards">{(data.completed || []).map((match) => <MatchCard key={match.id} match={match} />)}</div>
    </>
  );
}

function Standings({ data }: { data: { columns?: string[]; rows?: Array<Record<string, unknown>> } | null }) {
  if (!data?.rows) return <div className="state">Loading match data...</div>;
  if (!data.rows.length) return <div className="state empty">No standings available for this season. Cup competitions may not use a league table.</div>;
  return (
    <table className="table">
      <thead>
        <tr>
          {(data.columns || ["position", "team", "played", "won", "drawn", "lost", "points"]).map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i}>
            {(data.columns || Object.keys(row)).map((col) => {
              const value = row[col];
              if (col === "team" && value && typeof value === "object" && value && "id" in value) {
                const team = value as { id: number; name: string };
                return (
                  <td key={col}>
                    <Link to={`/team/${team.id}`}>{team.name}</Link>
                  </td>
                );
              }
              return <td key={col}>{value == null ? "—" : String(value)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CompetitionsPage() {
  const [data, setData] = useState<{ items: Array<{ id: number; name: string; country?: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson("/app/football/competitions").then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <>
      <h1>Competitions</h1>
      <DataState loading={!data && !error} error={error}>
        <div className="cards">
          {(data?.items || []).map((item) => (
            <Link className="card" key={item.id} to={`/competition/${item.id}`}>
              <strong>{item.name}</strong>
              <div className="meta">{item.country || "Region unavailable"} · ID {item.id}</div>
            </Link>
          ))}
        </div>
      </DataState>
    </>
  );
}
