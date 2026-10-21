import { Link } from "react-router-dom";
import type { Match } from "../api";

function score(side: Match["score"]["home"]) {
  return side.display || (side.current != null ? String(side.current) : "—");
}

export function MatchCard({ match }: { match: Match }) {
  const live = match.status.label === "Live" || match.status.label === "Halftime" || match.status.code.toLowerCase().includes("inprogress");
  const competitionTo = match.tournament.id ? `/competition/${match.tournament.id}` : undefined;
  return (
    <Link className="card" to={`/match/${match.id}`}>
      <div className="row">
        {competitionTo ? (
          <span
            className="meta"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = competitionTo;
            }}
          >
            {match.tournament.name || "Competition"}
          </span>
        ) : (
          <span className="meta">{match.tournament.name || "Competition unknown"}</span>
        )}
        {live ? <span className="live">{match.status.label}</span> : <span className="badge">{match.status.label}</span>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div>
          <div>{match.homeTeam.name || "Home unavailable"}</div>
          <div className="score">{score(match.score.home)}</div>
        </div>
        <div style={{ color: "var(--muted)" }}>vs</div>
        <div style={{ textAlign: "right" }}>
          <div>{match.awayTeam.name || "Away unavailable"}</div>
          <div className="score">{score(match.score.away)}</div>
        </div>
      </div>
      <div className="meta" style={{ marginTop: 10 }}>
        {match.status.description || ""}
        {match.minute != null ? ` · ${match.minute}'` : ""}
        {!live && match.startTime ? ` · ${new Date(match.startTime).toLocaleString()}` : ""}
        {match.venue ? ` · ${match.venue}` : ""}
      </div>
    </Link>
  );
}
