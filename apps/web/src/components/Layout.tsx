import { NavLink, Outlet } from "react-router-dom";

const links = [
  ["/", "Home"],
  ["/matches", "Matches"],
  ["/competitions", "Competitions"],
  ["/teams", "Teams"],
  ["/players", "Players"],
  ["/search", "Search"],
  ["/admin/gaps", "Gaps"],
  ["/admin/coverage", "Coverage"],
  ["/admin/endpoint-lab", "Endpoint Lab"],
  ["/admin/report", "Report"],
] as const;

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Football Lab</strong>
          <span>Football product + API gap harness</span>
        </div>
        <nav className="nav">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">
        SportsAPI365 football · product screens consume /app/football · gaps recorded on every provider call
      </footer>
    </div>
  );
}
