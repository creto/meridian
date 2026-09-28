import { randomBytes } from "node:crypto";

export interface TraceContext {
  traceId: string;
  requestId: string;
  tenantId?: string;
}

export interface Span {
  traceId: string;
  requestId: string;
  tenantId?: string;
  name: string;
  spanId: string;
  parentSpanId?: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  attrs: Record<string, unknown>;
}

function hex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function isSecretKey(key: string): boolean {
  const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm.includes("secret") || norm.includes("password") || norm.includes("token") || norm.includes("authorization") || norm.includes("apikey");
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? "***" : redactValue(inner);
    }
    return out;
  }
  return value;
}

function redactRecord(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  return redactValue(value) as Record<string, unknown>;
}

export function startTrace(input?: { tenantId?: string; requestId?: string }): TraceContext {
  const requestId = input?.requestId?.trim() ? input.requestId : hex(8);
  const trace: TraceContext = { traceId: hex(16), requestId };
  if (input?.tenantId) trace.tenantId = input.tenantId;
  return trace;
}

export function startSpan(parent: TraceContext | Span, name: string, attrs?: Record<string, unknown>): Span {
  const span: Span = {
    traceId: parent.traceId,
    requestId: parent.requestId,
    name,
    spanId: hex(8),
    startMs: Date.now(),
    attrs: redactRecord(attrs),
  };
  if (parent.tenantId) span.tenantId = parent.tenantId;
  if ("spanId" in parent && typeof parent.spanId === "string" && parent.spanId) {
    span.parentSpanId = parent.spanId;
  }
  return span;
}

export function endSpan(span: Span, attrs?: Record<string, unknown>): Span {
  if (attrs) {
    span.attrs = { ...span.attrs, ...redactRecord(attrs) };
  }
  span.endMs = Date.now();
  span.durationMs = Math.max(0, span.endMs - span.startMs);
  return span;
}

export function formatLog(span: Span, level: string, event: string, extra?: Record<string, unknown>): string {
  const payload: Record<string, unknown> = {
    ...redactRecord(span.attrs),
    ...(extra ? redactRecord(extra) : {}),
  };
  payload.timestamp = new Date().toISOString();
  payload.level = level;
  payload.service = "meridian";
  payload.tenantId = span.tenantId ?? null;
  payload.requestId = span.requestId;
  payload.traceId = span.traceId;
  payload.spanId = span.spanId;
  payload.event = event;
  if (span.parentSpanId) payload.parentSpanId = span.parentSpanId;
  if (span.durationMs != null) payload.durationMs = span.durationMs;
  return JSON.stringify(payload);
}
