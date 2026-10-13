import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import type { CallLog, GapRecord, ManualFinding, RelationshipCheck } from "./types.js";

function loadJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
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
  private persistTimer: NodeJS.Timeout | null = null;

  constructor() {
    mkdirSync(config.dataDir, { recursive: true });
    this.calls = loadJson(join(config.dataDir, "calls.json"), []);
    this.gaps = loadJson(join(config.dataDir, "gaps.json"), []);
    this.findings = loadJson(join(config.dataDir, "findings.json"), []);
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

  byFamily(family: string) {
    return this.calls.filter((call) => call.endpoint.includes(`/${family}`) || call.endpoint.includes(family));
  }

  private queuePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 400);
  }

  persist() {
    mkdirSync(config.dataDir, { recursive: true });
    writeFileSync(join(config.dataDir, "gaps.json"), JSON.stringify(this.gaps, null, 2));
    writeFileSync(join(config.dataDir, "calls.json"), JSON.stringify(this.calls.slice(-2000), null, 2));
    writeFileSync(join(config.dataDir, "findings.json"), JSON.stringify(this.findings, null, 2));
  }
}

export const store = new GapStore();
