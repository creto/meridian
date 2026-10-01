import { randomBytes } from "node:crypto";

export const SPAN = {
  http: "http.request",
  db: "db.transaction",
  jobEnqueue: "job.enqueue",
  jobExecute: "job.execute",
  workflow: "workflow.node",
  ai: "ai.call",
  pdf: "pdf.generate",
  storage: "storage.call",
  ecm: "ecm.call",
  webhook: "webhook.delivery",
} as const;

export const METRICS = [
  "http_requests_total",
  "http_request_duration_seconds",
  "db_query_duration_seconds",
  "job_queue_depth",
  "job_processing_duration_seconds",
  "workflow_instances_total",
  "workflow_failures_total",
  "workflow_duration_seconds",
  "pdf_generation_duration_seconds",
  "ai_generation_duration_seconds",
  "webhook_failures_total",
  "storage_failures_total",
  "ecm_failures_total",
  "form_render_duration_seconds",
  "submission_validation_duration_seconds",
] as const;

export type MetricName = (typeof METRICS)[number];

const SECRET = /secret|password|token|authorization|apikey/i;

export function redactAttr(key: string, value: unknown): unknown {
  if (SECRET.test(key.replace(/[^a-z]/gi, ""))) return "***";
  return value;
}

export interface TraceParent {
  version: string;
  traceId: string;
  spanId: string;
  flags: string;
}

export function parseTraceParent(header: string | null): TraceParent | null {
  if (!header) return null;
  const match = /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/.exec(header.trim());
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return null;
  return { version: match[1], traceId: match[2], spanId: match[3], flags: match[4] };
}

export function formatTraceParent(parent: TraceParent): string {
  return `${parent.version}-${parent.traceId}-${parent.spanId}-${parent.flags}`;
}

export interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startMs: number;
  endMs?: number;
  attributes: Record<string, unknown>;
}

export class Tracer {
  readonly spans: SpanRecord[] = [];
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  startSpan(name: string, input?: { parent?: string | null; attributes?: Record<string, unknown>; now?: number }): SpanRecord {
    const parent = parseTraceParent(input?.parent ?? null);
    const traceId = parent?.traceId ?? randomBytes(16).toString("hex");
    const spanId = randomBytes(8).toString("hex");
    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input?.attributes ?? {})) attributes[key] = redactAttr(key, value);
    const span: SpanRecord = { traceId, spanId, name, startMs: input?.now ?? Date.now(), attributes };
    if (parent) span.parentSpanId = parent.spanId;
    this.spans.push(span);
    return span;
  }

  end(span: SpanRecord, now = Date.now()): void {
    span.endMs = now;
  }

  counter(name: MetricName, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
  }

  histogram(name: MetricName, seconds: number): void {
    const list = this.histograms.get(name) ?? [];
    list.push(seconds);
    this.histograms.set(name, list);
  }

  snapshot(): { counters: Record<string, number>; histograms: Record<string, { count: number; sum: number }> } {
    const counters: Record<string, number> = {};
    for (const name of METRICS) counters[name] = this.counters.get(name) ?? 0;
    const histograms: Record<string, { count: number; sum: number }> = {};
    for (const [name, values] of this.histograms) {
      histograms[name] = { count: values.length, sum: values.reduce((sum, value) => sum + value, 0) };
    }
    return { counters, histograms };
  }

  exportOtlpJson(): { resourceSpans: unknown[]; resourceMetrics: unknown[] } {
    return {
      resourceSpans: [{
        resource: { attributes: [{ key: "service.name", value: { stringValue: "meridian" } }] },
        scopeSpans: [{
          spans: this.spans.map((span) => ({
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            name: span.name,
            startTimeUnixNano: String(span.startMs * 1_000_000),
            endTimeUnixNano: String((span.endMs ?? span.startMs) * 1_000_000),
            attributes: Object.entries(span.attributes).map(([key, value]) => ({ key, value: { stringValue: String(value) } })),
          })),
        }],
      }],
      resourceMetrics: [{
        scopeMetrics: [{
          metrics: [...this.counters.entries()].map(([name, value]) => ({ name, sum: { dataPoints: [{ asInt: value }] } })),
        }],
      }],
    };
  }
}

export async function exportOtlp(tracer: Tracer, fetchImpl: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<{ exported: boolean; reason?: string; status?: number }> {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim().replace(/\/$/, "");
  if (!endpoint) return { exported: false, reason: "OTEL_EXPORTER_OTLP_ENDPOINT is not set" };
  const response = await fetchImpl(`${endpoint}/v1/traces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tracer.exportOtlpJson()),
  });
  return { exported: response.ok, status: response.status, reason: response.ok ? undefined : `HTTP ${response.status}` };
}

export function childTraceParent(span: SpanRecord): string {
  return formatTraceParent({ version: "00", traceId: span.traceId, spanId: span.spanId, flags: "01" });
}
