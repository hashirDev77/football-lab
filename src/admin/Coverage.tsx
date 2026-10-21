import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getJson } from "../api";

interface Coverage {
  screens: Array<{ screen: string; complete: number; partial: number; broken: number; scores: Record<string, number>; gapCount: number }>;
  experiences: Array<{ label: string; overall: number; screens: string[] }>;
  totals: Record<string, number>;
  endpoints: Array<{ path: string; screen: string; status: string; lastStatus: number | null; lastMs: number | null; gapCount: number; coverageScore: number }>;
}

export function CoveragePage() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  useEffect(() => {
    getJson("/admin/football/coverage").then(setCoverage);
  }, []);
  return (
    <>
      <h1>Coverage dashboard</h1>
      <div className="kpi">
        {coverage &&
          Object.entries(coverage.totals).slice(0, 12).map(([key, value]) => (
            <div className="card" key={key}>
              <b>{value}</b>
              <span className="meta">{key}</span>
            </div>
          ))}
      </div>
      <h2>Experience scores</h2>
      <div className="kpi">
        {(coverage?.experiences || []).map((row) => (
          <div className="card" key={row.label}>
            <b>{row.overall}%</b>
            <span className="meta">{row.label}</span>
          </div>
        ))}
      </div>
      <h2>Screen coverage</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Area</th>
            <th>Complete</th>
            <th>Partial</th>
            <th>Broken</th>
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          {(coverage?.screens || []).map((row) => (
            <tr key={row.screen}>
              <td>
                <Link to={`/admin/gaps/screen/${encodeURIComponent(row.screen)}`}>{row.screen}</Link>
              </td>
              <td>{row.complete}%</td>
              <td>{row.partial}%</td>
              <td>{row.broken}%</td>
              <td>{row.scores.overall}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
