import { randomUUID } from "node:crypto";
import { SLOW_MS, type CallHook } from "../raw/client.js";
import { isOptionalEnrichment404 } from "../raw/unwrap.js";
import type { ProviderResult } from "../raw/types.js";
import { store } from "./store.js";
import type { CallLog, CallMeta, GapRecord, GapType, Severity } from "./types.js";

export class RequestContext {
  calls: CallLog[] = [];
  gaps: GapRecord[] = [];
  fallback = 0;
  sequential = 0;
  parallel = 0;
  minimum = 1;

  constructor(
    public readonly screen: string,
    public readonly component = "page",
  ) {}

  handleCall(result: ProviderResult, hook?: CallHook) {
    const log: CallLog = {
      id: randomUUID(),
      endpoint: result.endpoint,
      params: result.params,
      screen: hook?.screen || this.screen,
      component: hook?.component || this.component,
      status: result.status,
      ms: result.ms,
      bytes: result.bytes,
      requiredMissing: [],
      optionalMissing: [],
      fallbackUsed: Boolean(hook?.fallback),
      fallbackEndpoint: hook?.fallbackEndpoint,
      error: result.error,
      timestamp: result.timestamp,
    };
    this.calls.push(log);
    store.addCall(log);

    if (hook?.fallback) this.fallback += 1;
    if (result.ms >= SLOW_MS) {
      this.recordGap({
        code: "SLOW_ENDPOINT",
        type: "SLOW_ENDPOINT",
        severity: "P2",
        component: log.component,
        endpoint: result.endpoint,
        expected: `response under ${SLOW_MS}ms`,
        actual: `${result.ms}ms`,
        userImpact: "Tab or screen feels slow compared with other football calls.",
        developerImpact: "Do not include this call in the initial page payload.",
        recommendation: "Lazy-load this endpoint and publish typical latency.",
      });
    }
    if (isOptionalEnrichment404(result)) {
      this.recordGap({
        code: "OPTIONAL_404",
        type: "OPTIONAL_404",
        severity: "P1",
        component: log.component,
        endpoint: result.endpoint,
        expected: "200 empty optional payload",
        actual: `404 ${result.error || ""}`.trim(),
        userImpact: "Optional widget cannot be distinguished from a missing match.",
        developerImpact: "Clients must special-case enrichment 404s.",
        recommendation: "Return 200 with an empty object for optional extras.",
      });
    }
  }

  recordGap(partial: {
    code: string;
    type: GapType;
    severity: Severity;
    component?: string;
    endpoint: string;
    field?: string;
    expected: string;
    actual: string;
    fallback?: string;
    extraCalls?: number;
    userImpact: string;
    developerImpact: string;
    recommendation?: string;
    evidence?: Record<string, unknown>;
  }) {
    const gap: GapRecord = {
      id: randomUUID(),
      screen: this.screen,
      component: partial.component || this.component,
      timestamp: new Date().toISOString(),
      ...partial,
    };
    this.gaps.push(gap);
    store.addGap(gap);
    return gap;
  }

  meta(): CallMeta {
    return {
      minimum: this.minimum,
      actual: this.calls.length,
      fallback: this.fallback,
      sequential: this.sequential,
      parallel: this.parallel,
    };
  }
}

export function withClient(ctx: RequestContext) {
  return {
    onCall: (result: ProviderResult, hook?: CallHook) => ctx.handleCall(result, hook),
  };
}
