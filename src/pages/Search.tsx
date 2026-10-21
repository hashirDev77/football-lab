import { useState } from "react";
import { Link } from "react-router-dom";
import { getJson } from "../api";
import { DataState } from "../components/DataState";

interface Hit {
  type: string;
  id: number | null;
  name: string | null;
}

export function SearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ players: Hit[]; teams: Hit[]; competitions: Hit[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setData(await getJson(`/app/football/search?q=${encodeURIComponent(q)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function Group({ title, items, to }: { title: string; items: Hit[]; to: (id: number) => string }) {
    return (
      <section className="group">
        <h2>{title}</h2>
        {items.length ? (
          <div className="cards">
            {items.map((item) =>
              item.id ? (
                <Link className="card" key={`${item.type}-${item.id}`} to={to(item.id)}>
                  {item.name}
                </Link>
              ) : (
                <div className="card" key={item.name}>
                  {item.name} <div className="meta">ID unavailable — cannot open</div>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="state empty">No {title.toLowerCase()}.</div>
        )}
      </section>
    );
  }

  return (
    <>
      <h1>Search</h1>
      <p className="meta">Try Arsenal, Manchester, United, Saka, Mohamed Salah, Champions, Liverpool, Liverpol.</p>
      <form className="searchbar" onSubmit={run}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player, team, or competition" />
        <button type="submit">Search</button>
      </form>
      <DataState loading={loading} error={error}>
        {data && (
          <>
            <Group title="Players" items={data.players} to={(id) => `/player/${id}`} />
            <Group title="Teams" items={data.teams} to={(id) => `/team/${id}`} />
            <Group title="Competitions" items={data.competitions} to={(id) => `/competition/${id}`} />
          </>
        )}
      </DataState>
    </>
  );
}
