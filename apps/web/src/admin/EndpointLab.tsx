import { useEffect, useState } from "react";
import { getJson, postJson } from "../api";

interface EndpointRow {
  path: string;
  screen: string;
  family: string;
  status: string;
  lastStatus: number | null;
  lastMs: number | null;
  lastBytes: number | null;
  lastTested: string | null;
  callCount: number;
  gapCount: number;
  empty: boolean;
  useful: boolean;
  coverageScore: number;
}

export function EndpointLabPage() {
  const [data, setData] = useState<{ endpoints: EndpointRow[]; totals: Record<string, number> } | null>(null);
  const [selected, setSelected] = useState<EndpointRow | null>(null);
  const [path, setPath] = useState("fixtures/today");
  const [probe, setProbe] = useState<unknown>(null);

  useEffect(() => {
    getJson("/admin/football/endpoint-lab").then(setData);
  }, []);

  async function runProbe() {
    setProbe(await postJson("/admin/football/endpoint-lab/probe", { path }));
  }

  return (
    <>
      <h1>Endpoint Lab</h1>
      <p className="meta">{data?.totals.catalog ?? 43} catalog routes. Click a row or probe a path directly.</p>
      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          runProbe();
        }}
      >
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="fixtures/today or event/123/lineups" />
        <button type="submit">Probe</button>
      </form>
      {probe ? <pre className="panel meta">{JSON.stringify(probe, null, 2)}</pre> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Family</th>
            <th>HTTP</th>
            <th>ms</th>
            <th>bytes</th>
            <th>Useful</th>
            <th>Gaps</th>
            <th>Score</th>
            <th>Last tested</th>
          </tr>
        </thead>
        <tbody>
          {(data?.endpoints || []).map((row) => (
            <tr key={row.path} onClick={() => { setSelected(row); setPath(row.path.replace(/^\//, "").replace(/\{[^}]+\}/g, "1")); }}>
              <td>{row.path}</td>
              <td>{row.family}</td>
              <td>{row.lastStatus ?? "—"}</td>
              <td>{row.lastMs ?? "—"}</td>
              <td>{row.lastBytes ?? "—"}</td>
              <td>{row.useful ? "yes" : row.empty ? "empty" : "—"}</td>
              <td>{row.gapCount}</td>
              <td>{row.coverageScore}</td>
              <td className="meta">{row.lastTested ? new Date(row.lastTested).toLocaleString() : "untested"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <div className="panel">
          <h2>{selected.path}</h2>
          <pre className="meta">{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
    </>
  );
}
