import type { ReactNode } from "react";

export function StatCompare({
  rows,
}: {
  rows: Array<{ name: string; home: string | number | null; away: string | number | null }>;
}) {
  if (!rows.length) return <div className="state empty">Match statistics are unavailable.</div>;
  return (
    <div className="panel">
      {rows.map((row) => {
        const homeNum = Number(row.home);
        const awayNum = Number(row.away);
        const numeric = Number.isFinite(homeNum) && Number.isFinite(awayNum);
        const total = numeric ? homeNum + awayNum : 0;
        return (
          <div key={row.name} className="stat-bar">
            <span>{row.home ?? "—"}</span>
            <div>
              <div className="meta" style={{ textAlign: "center" }}>
                {row.name}
              </div>
              {numeric && total > 0 ? (
                <div className="track">
                  <div className="home" style={{ width: `${(homeNum / total) * 100}%` }} />
                  <div className="away" style={{ width: `${(awayNum / total) * 100}%` }} />
                </div>
              ) : null}
            </div>
            <span style={{ textAlign: "right" }}>{row.away ?? "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function JsonPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
