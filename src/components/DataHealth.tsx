import { useState } from "react";
import { Link } from "react-router-dom";
import { postJson, type Health, type Meta } from "../api";

export function DataHealth({
  title,
  health,
  meta,
  endpoint,
  screen,
}: {
  title: string;
  health?: Health | null;
  meta?: Meta | null;
  endpoint?: string;
  screen?: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ expected: "", actual: "", notes: "", severity: "P2" });
  const [saved, setSaved] = useState("");

  async function addFinding(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/admin/football/findings", {
      screen: screen || title,
      endpoint: endpoint || "",
      severity: form.severity,
      category: "DOCUMENTATION_GAP",
      expected: form.expected,
      actual: form.actual,
      userImpact: form.notes || "Manual finding from Data Health.",
      developerImpact: form.notes || "Needs API investigation.",
      notes: form.notes,
    });
    setSaved("Finding saved.");
  }

  return (
    <div className="health">
      <button className="btn ghost" type="button" onClick={() => setOpen(!open)}>
        Data Health{health ? ` · ${health.coverage}%` : meta ? ` · ${meta.gaps.length} gaps` : ""}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <strong>{title}</strong>
          {health && (
            <table className="table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Status</th>
                  <th>Actual</th>
                </tr>
              </thead>
              <tbody>
                {health.checks.map((check) => (
                  <tr key={check.field}>
                    <td>{check.field}</td>
                    <td>{check.status}</td>
                    <td>{check.actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {meta && (
            <p className="meta">
              {meta.calls.actual} calls · {meta.calls.fallback} fallbacks ·{" "}
              {meta.gaps.slice(0, 3).map((gap) => (
                <Link key={gap.id} to={`/admin/gaps/${gap.id}`}>
                  {gap.code}{" "}
                </Link>
              ))}
            </p>
          )}
          <form className="grid" onSubmit={addFinding} style={{ marginTop: 8 }}>
            <input className="field" placeholder="Expected" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} />
            <input className="field" placeholder="Actual" value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} />
            <textarea className="field" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option>P0</option>
              <option>P1</option>
              <option>P2</option>
              <option>P3</option>
            </select>
            <button className="btn" type="submit">
              Add Finding
            </button>
            {saved && <span className="meta">{saved}</span>}
          </form>
        </div>
      )}
    </div>
  );
}
