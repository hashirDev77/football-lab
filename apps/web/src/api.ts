export async function getJson<T = any>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((body as { error?: string }).error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function postJson<T = any>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((payload as { error?: string }).error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export interface Meta {
  calls: { minimum: number; actual: number; fallback: number; sequential: number; parallel: number };
  gaps: Array<{ id: string; code: string; type: string; severity: string; expected: string; actual: string }>;
}

export interface TeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  logo?: string | null;
}

export interface Match {
  id: number;
  status: { code: string; label: string; description?: string | null };
  startTime: string | null;
  minute: number | null;
  tournament: { id: number | null; name: string | null };
  round: string | null;
  season: string | null;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: {
    home: { current: number | null; display: string | null };
    away: { current: number | null; display: string | null };
  };
  venue: string | null;
  referee: string | null;
  result: string | null;
}

export interface Player {
  id: number;
  name: string | null;
  team: TeamRef | null;
  country: string | null;
  position: string | null;
  shirtNumber: number | null;
  age: number | null;
  image: string | null;
}

export interface Widget {
  status: string;
  data?: unknown;
  note?: string;
}

export interface Health {
  coverage: number;
  checks: Array<{ field: string; status: string; expected: string; actual: string }>;
}
