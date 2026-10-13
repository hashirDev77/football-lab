import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getJson, type Match } from "../api";
import { DataState } from "../components/DataState";
import { MatchCard } from "../components/MatchCard";

const tabs = [
  ["live", "Live"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["results", "Results"],
] as const;

export function MatchesPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") || "today") as (typeof tabs)[number][0];
  const [data, setData] = useState<Record<string, Match[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    getJson<Record<string, Match[]>>(`/app/football/matches?tab=${tab}`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [tab]);

  const list =
    tab === "live" ? data?.live : tab === "results" ? data?.results : tab === "upcoming" ? data?.upcoming : data?.today;

  return (
    <>
      <h1>Match explorer</h1>
      <p className="meta">Discovery uses /events and /fixtures/today. Extra filters that the API does not support are recorded as gaps.</p>
      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setParams({ tab: id })}>
            {label}
          </button>
        ))}
      </div>
      <DataState
        loading={!data && !error}
        error={error}
        empty={Boolean(data && !(list || []).length)}
        emptyText={tab === "results" ? "No completed matches from the finished filter." : "No matches in this tab."}
      >
        <div className="cards">
          {(list || []).map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </DataState>
    </>
  );
}
