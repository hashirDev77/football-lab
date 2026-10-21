import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJson, type Match, type Player } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";
import { DataHealth } from "../components/DataHealth";

export function PlayerPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [overview, setOverview] = useState<{ player: Player; rawMissing: string[]; _meta?: unknown } | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [matches, setMatches] = useState<{ recent: Match[]; upcoming: Match[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ player: Player; rawMissing: string[] }>(`/app/football/players/${id}`)
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (tab === "statistics") {
      getJson(`/app/football/players/${id}/statistics`).then(setStats).catch((err: Error) => setError(err.message));
    }
    if (tab === "recent" || tab === "upcoming") {
      getJson<{ recent: Match[]; upcoming: Match[] }>(`/app/football/players/${id}/matches`)
        .then(setMatches)
        .catch((err: Error) => setError(err.message));
    }
  }, [id, tab]);

  const player = overview?.player;
  return (
    <DataState loading={!overview && !error} error={error}>
      {player && (
        <>
          <h1>{player.name}</h1>
          <p className="meta">
            {player.team?.id ? <Link to={`/team/${player.team.id}`}>{player.team.name}</Link> : player.team?.name || "Team unavailable"} ·{" "}
            {player.country || "Nationality unavailable"} · {player.position || "Position unavailable"}
          </p>
          <p className="meta">
            Shirt {player.shirtNumber ?? "unavailable"} · Age {player.age ?? "unavailable"}
          </p>
          <div className="tabs">
            {["overview", "statistics", "recent", "upcoming"].map((item) => (
              <button key={item} className={tab === item ? "active" : ""} onClick={() => setParams({ tab: item })}>
                {item}
              </button>
            ))}
          </div>
          {tab === "overview" && (
            <div className="panel">
              <p>Missing profile fields: {overview?.rawMissing.join(", ") || "none recorded"}</p>
              <DataHealth title="Player profile" meta={overview?._meta as never} endpoint="/player/{id}" screen="Player" />
            </div>
          )}
          {tab === "statistics" && (
            <DataState loading={!stats} error={null} empty={Boolean(stats && stats.available === false)} emptyText="No statistics available for this season.">
              {stats && stats.available !== false && <pre className="panel meta">{JSON.stringify(stats.raw, null, 2)}</pre>}
            </DataState>
          )}
          {tab === "recent" && (
            <div className="cards">
              {(matches?.recent || []).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
          {tab === "upcoming" && (
            <div className="cards">
              {(matches?.upcoming || []).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </>
      )}
    </DataState>
  );
}

export function PlayersPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Player[]; hasMore?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson<{ items: Player[]; hasMore?: boolean }>(`/app/football/players?page=${page}`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [page]);
  return (
    <>
      <h1>Players</h1>
      <DataState loading={!data && !error} error={error}>
        <div className="cards">
          {(data?.items || []).map((player) => (
            <Link className="card" key={player.id} to={`/player/${player.id}`}>
              <strong>{player.name}</strong>
              <div className="meta">
                {player.country || "Country unavailable"} · {player.position || "Position unavailable"} · ID {player.id}
              </div>
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
