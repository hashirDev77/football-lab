import type { ReactNode } from "react";

export function DataState({
  loading,
  error,
  empty,
  emptyText,
  unavailable,
  unavailableText,
  children,
}: {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  unavailable?: boolean;
  unavailableText?: string;
  children: ReactNode;
}) {
  if (loading) return <div className="state">Loading match data...</div>;
  if (error) return <div className="state error">This information could not be loaded. {error}</div>;
  if (unavailable) return <div className="state empty">{unavailableText || "This information is unavailable."}</div>;
  if (empty) return <div className="state empty">{emptyText || "This information is not available."}</div>;
  return <>{children}</>;
}

export function widgetCopy(status?: string, note?: string, emptyMean?: string) {
  if (status === "SUPPORTED") return null;
  if (status === "EMPTY") return emptyMean || note || "No data was returned.";
  if (status === "OPTIONAL_404" || status === "UNAVAILABLE") return note || "This information is unavailable.";
  if (status === "ERROR") return note || "This information could not be loaded.";
  if (status === "NO_DATA") return note || "Data unavailable.";
  return note || "Unknown data state.";
}
