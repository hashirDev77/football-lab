export const GAP_TYPES = [
  "MISSING_FIELD",
  "NULL_FIELD",
  "EMPTY_RESPONSE",
  "OPTIONAL_404",
  "BROKEN_RELATIONSHIP",
  "SCHEMA_INCONSISTENCY",
  "STATUS_INCONSISTENCY",
  "FILTER_INCOMPLETE",
  "STALE_DATA",
  "SLOW_ENDPOINT",
  "DOCUMENTATION_GAP",
  "AUTHENTICATION_GAP",
  "PAGINATION_GAP",
  "DERIVATION_REQUIRED",
  "EXTRA_REQUEST_REQUIRED",
] as const;

export type GapType = (typeof GAP_TYPES)[number];
export type Severity = "P0" | "P1" | "P2" | "P3";
export type FieldStatus = "AVAILABLE" | "DERIVED" | "MISSING" | "NULL" | "INCONSISTENT";
export type WidgetStatus = "SUPPORTED" | "NO_DATA" | "OPTIONAL_404" | "EMPTY" | "NOT_DOCUMENTED" | "ERROR" | "UNAVAILABLE" | "PARTIAL";

export interface CallLog {
  id: string;
  endpoint: string;
  params?: Record<string, string | number | undefined>;
  screen: string;
  component: string;
  status: number;
  ms: number;
  bytes: number;
  requiredMissing: string[];
  optionalMissing: string[];
  fallbackUsed: boolean;
  fallbackEndpoint?: string;
  error?: string;
  timestamp: string;
}

export interface GapRecord {
  id: string;
  code: string;
  type: GapType;
  severity: Severity;
  screen: string;
  component: string;
  endpoint: string;
  field?: string;
  expected: string;
  actual: string;
  fallback?: string;
  extraCalls?: number;
  userImpact: string;
  developerImpact: string;
  recommendation?: string;
  timestamp: string;
  evidence?: Record<string, unknown>;
}

export interface ManualFinding {
  id: string;
  screen: string;
  endpoint: string;
  severity: Severity;
  category: GapType;
  expected: string;
  actual: string;
  userImpact: string;
  developerImpact: string;
  notes?: string;
  timestamp: string;
}

export interface CallMeta {
  minimum: number;
  actual: number;
  fallback: number;
  sequential: number;
  parallel: number;
}

export interface QualityScores {
  availability: number;
  completeness: number;
  consistency: number;
  freshness: number;
  performance: number;
  developerUsability: number;
  overall: number;
}

export interface RelationshipCheck {
  from: string;
  to: string;
  idExists: boolean;
  idResolves: boolean | null;
  nameMatches: boolean | null;
  agreed: boolean;
  notes: string;
}

export interface FieldClassification {
  field: string;
  status: FieldStatus;
  value?: unknown;
}

export interface HealthCheck {
  field: string;
  status: FieldStatus | "UNKNOWN" | "PARTIAL";
  expected: string;
  actual: string;
}
