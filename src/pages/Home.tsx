import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getJson, type Match, type Meta } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";
import { DataHealth } from "../components/DataHealth";

interface HomeData {
  live: Match[];
  today: Match[];
  upcoming: Match[];
  completed: Match[];
  competitions: Array<{ id: number; name: string; country?: string }>;
  _meta: Meta;
}

function Section({ title, matches }: { title: string; matches: Match[] }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {matches.length ? (
        <div className="cards">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="state empty">No matches in this section right now.</div>
      )}
    </section>
  );
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson<HomeData>("/app/football/home").then(setData).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <DataState loading={!data && !error} error={error}>
      {data && (
        <>
          <h1>What's happening in football</h1>
          <p className="meta">
            {data._meta.calls.actual} API calls · {data._meta.calls.fallback} fallbacks · {data._meta.gaps.length} gaps on this screen
          </p>
          <DataHealth title="Home dashboard" meta={data._meta} endpoint="/fixtures/today" screen="Home" />
          <Section title="Live / Active" matches={data.live} />
          <Section title="Today's Matches" matches={data.today} />
          <Section title="Upcoming" matches={data.upcoming} />
          <Section title="Recently Finished" matches={data.completed} />
          <section className="group">
            <h2>Featured Competitions</h2>
            <div className="cards">
              {(data.competitions || []).map((item) => (
                <Link className="card" key={item.id} to={`/competition/${item.id}`}>
                  <strong>{item.name}</strong>
                  <div className="meta">{item.country || "Region unavailable"}</div>
                </Link>
              ))}
            </div>
          </section>
          <p className="meta">
            <Link to="/teams">Teams</Link> · <Link to="/players">Players</Link> · <Link to="/search">Global search</Link>
          </p>
        </>
      )}
    </DataState>
  );
}
