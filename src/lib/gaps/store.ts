import type { CallLog, GapRecord, ManualFinding, RelationshipCheck } from "./types";

const STORAGE_KEYS = {
  calls: "football-lab-calls",
  gaps: "football-lab-gaps",
  findings: "football-lab-findings",
} as const;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

class GapStore {
  calls: CallLog[] = [];
  gaps: GapRecord[] = [];
  findings: ManualFinding[] = [];
  relationships: RelationshipCheck[] = [];
  schemaNotes: Array<{ endpoint: string; field: string; observed: string; canonical: string }> = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.calls = loadJson(STORAGE_KEYS.calls, []);
    this.gaps = loadJson(STORAGE_KEYS.gaps, []);
    this.findings = loadJson(STORAGE_KEYS.findings, []);
  }

  addCall(call: CallLog) {
    this.calls.push(call);
    if (this.calls.length > 5000) this.calls = this.calls.slice(-4000);
    this.queuePersist();
  }

  addGap(gap: GapRecord) {
    const existing = this.gaps.findIndex(
      (item) =>
        item.code === gap.code &&
        item.screen === gap.screen &&
        item.component === gap.component &&
        item.endpoint === gap.endpoint &&
        item.field === gap.field,
    );
    if (existing >= 0) {
      this.gaps[existing] = { ...gap, id: this.gaps[existing].id };
    } else {
      this.gaps.push(gap);
    }
    this.queuePersist();
  }

  addFinding(finding: ManualFinding) {
    this.findings.push(finding);
    this.queuePersist();
  }

  addRelationship(check: RelationshipCheck) {
    this.relationships.push(check);
    if (this.relationships.length > 1000) this.relationships = this.relationships.slice(-800);
  }

  addSchemaNote(note: { endpoint: string; field: string; observed: string; canonical: string }) {
    const key = `${note.endpoint}:${note.field}:${note.observed}`;
    if (!this.schemaNotes.some((item) => `${item.endpoint}:${item.field}:${item.observed}` === key)) {
      this.schemaNotes.push(note);
    }
  }

  byScreen(screen: string) {
    return this.gaps.filter((gap) => gap.screen.toLowerCase() === screen.toLowerCase());
  }

  byEndpoint(endpoint: string) {
    return this.gaps.filter((gap) => gap.endpoint.includes(endpoint));
  }

  private queuePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 400);
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(this.gaps));
      localStorage.setItem(STORAGE_KEYS.calls, JSON.stringify(this.calls.slice(-2000)));
      localStorage.setItem(STORAGE_KEYS.findings, JSON.stringify(this.findings));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }
}

export const store = new GapStore();
