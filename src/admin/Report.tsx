import { useEffect, useState } from "react";
import { getJson } from "../api";

export function ReportPage() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getJson("/admin/football/report").then(setReport);
  }, []);

  async function download(kind: "json" | "csv") {
    const payload =
      kind === "json"
        ? JSON.stringify(report ?? (await getJson("/admin/football/report")), null, 2)
        : await getJson<string>("/admin/football/report.csv");
    const blob = new Blob([payload], { type: kind === "json" ? "application/json" : "text/csv" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = kind === "json" ? "football-api-report.json" : "football-api-report.csv";
    a.click();
    URL.revokeObjectURL(href);
  }

  async function copySummary() {
    const totals = (report?.totals || {}) as Record<string, number>;
    const experiences = (report?.experiences || []) as Array<{ label: string; overall: number }>;
    const text = [
      "Football API Coverage Lab",
      `Generated ${report?.generatedAt || ""}`,
      `Catalog ${totals.catalog} · tested ${totals.tested} · useful ${totals.useful} · empty ${totals.empty} · errors ${totals.errors}`,
      ...experiences.map((row) => `${row.label}: ${row.overall}%`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <>
      <h1>Exportable report</h1>
      <div className="row">
        <button className="btn" onClick={() => download("json")}>
          Export JSON
        </button>
        <button className="btn" onClick={() => download("csv")}>
          Export CSV
        </button>
        <button className="btn ghost" onClick={copySummary}>
          Copy summary
        </button>
        {copied && <span className="meta">Copied.</span>}
      </div>
      <pre className="panel meta">{JSON.stringify(report, null, 2)}</pre>
    </>
  );
}
