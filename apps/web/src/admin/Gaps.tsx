import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJson } from "../api";

interface Gap {
  id: string;
  code: string;
  type: string;
  severity: string;
  screen: string;
  component: string;
  endpoint: string;
  expected: string;
  actual: string;
}

export function GapsPage() {
  const [gaps, setGaps] = useState<{
    gaps: Gap[];
    findings: Array<Record<string, unknown>>;
    recommendations: Array<{ title: string; body: string }>;
  } | null>(null);

  useEffect(() => {
    getJson("/admin/football/gaps").then(setGaps);
  }, []);

  return (
    <>
      <h1>API Gap Dashboard</h1>
      <p className="meta">Product usability health, not just endpoint uptime.</p>
      <h2>Recommendations</h2>
      {(gaps?.recommendations || []).map((rec) => (
        <div className="panel group" key={rec.title}>
          <h3>{rec.title}</h3>
          <p>{rec.body}</p>
        </div>
      ))}
      <h2>Gaps</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Code</th>
            <th>Screen</th>
            <th>Endpoint</th>
            <th>Expected</th>
          </tr>
        </thead>
        <tbody>
          {(gaps?.gaps || []).map((gap) => (
            <tr key={gap.id}>
              <td className={`sev-${gap.severity}`}>{gap.severity}</td>
              <td>
                <Link to={`/admin/gaps/${gap.id}`}>{gap.code}</Link>
              </td>
              <td>{gap.screen}</td>
              <td>{gap.endpoint}</td>
              <td>{gap.expected}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Manual findings</h2>
      <pre className="panel meta">{JSON.stringify(gaps?.findings || [], null, 2)}</pre>
    </>
  );
}

export function GapDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (id) getJson(`/admin/football/gaps/${id}`).then(setData);
  }, [id]);
  const gap = data?.gap as Record<string, unknown> | undefined;
  return (
    <>
      <h1>{String(gap?.code || "Gap")}</h1>
      {gap && (
        <div className="panel">
          <p>Affected endpoint: {String(gap.endpoint)}</p>
          <p>Affected screen: {String(gap.screen)}</p>
          <p>Affected component: {String(gap.component)}</p>
          <p>Expected: {String(gap.expected)}</p>
          <p>Actual: {String(gap.actual)}</p>
          <p>Fallback: {String(gap.fallback || "none")}</p>
          <p>Extra requests: {String(gap.extraCalls ?? 0)}</p>
          <p>User impact: {String(gap.userImpact)}</p>
          <p>Developer impact: {String(gap.developerImpact)}</p>
          <p>Recommendation: {String(gap.recommendation || "—")}</p>
        </div>
      )}
    </>
  );
}

export function GapScreenPage() {
  const { screen = "" } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    getJson(`/admin/football/gaps/screen/${encodeURIComponent(screen)}`).then(setData);
  }, [screen]);
  return (
    <>
      <h1>{screen}</h1>
      <pre className="panel meta">{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}
