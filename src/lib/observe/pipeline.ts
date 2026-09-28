import { METRICS, SPAN, Tracer, formatTraceParent, parseTraceParent, redactAttr, type MetricName } from "./otel.ts";

export interface RequestContext {
  method: string;
  path: string;
  traceParent: string | null;
  requestId: string;
}

const SECRET_IN_TEXT = /(?:secret|password|token|authorization)["']?\s*[:=]\s*["']?[^"'\s]+/gi;

export function redactLogLine(line: string): string {
  return line.replace(SECRET_IN_TEXT, (match) => match.replace(/[:=]\s*["']?[^"'\s]+/, ": ***"));
}

export function beginRequest(tracer: Tracer, ctx: RequestContext, now: number) {
  const span = tracer.startSpan(SPAN.http, {
    parent: ctx.traceParent,
    now,
    attributes: {
      "http.method": ctx.method,
      "http.route": ctx.path,
      requestId: ctx.requestId,
    },
  });
  return span;
}

export function finishRequest(tracer: Tracer, spanId: string, status: number, now: number) {
  const span = tracer.spans.find((item) => item.spanId === spanId);
  if (!span) return;
  span.endMs = now;
  span.attributes["http.status"] = status;
  const seconds = Math.max(0, now - span.startMs) / 1000;
  tracer.counter(METRICS[0], 1);
  tracer.histogram(METRICS[1], seconds);
}

export async function traceStep<T>(
  tracer: Tracer,
  name: string,
  metric: MetricName | null,
  attributes: Record<string, unknown>,
  fn: () => Promise<T>,
  now: () => number,
): Promise<T> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) safe[key] = redactAttr(key, value);
  const span = tracer.startSpan(name, { now: now(), attributes: safe });
  try {
    const value = await fn();
    span.endMs = now();
    if (metric) tracer.histogram(metric, Math.max(0, (span.endMs ?? span.startMs) - span.startMs) / 1000);
    return value;
  } catch (error) {
    span.endMs = now();
    span.attributes.error = error instanceof Error ? error.message : "failed";
    throw error;
  }
}

export function correlationHeaders(traceParent: string | null, requestId: string): Record<string, string> {
  const parsed = parseTraceParent(traceParent);
  const headers: Record<string, string> = { "x-request-id": requestId };
  if (parsed) headers.traceparent = formatTraceParent(parsed);
  return headers;
}

export function assertKnownMetrics(names: string[]): string[] {
  const known = new Set<string>(METRICS);
  return names.filter((name) => !known.has(name));
}
