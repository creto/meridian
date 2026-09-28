export interface LogEvent {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  service: string;
  event: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  detail?: Record<string, string | number | boolean | null>;
}

const SECRET = /secret|password|token|authorization|api[_-]?key/i;

export function redactDetail(detail: Record<string, unknown> | undefined): LogEvent["detail"] {
  if (!detail) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SECRET.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value === undefined) continue;
    if (value === null || typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
    else out[key] = "[object]";
  }
  return out;
}

export function logEvent(input: Omit<LogEvent, "timestamp"> & { timestamp?: string; detail?: Record<string, unknown> }): LogEvent {
  const event: LogEvent = {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: input.level,
    service: input.service,
    event: input.event,
    tenantId: input.tenantId,
    userId: input.userId,
    requestId: input.requestId,
    correlationId: input.correlationId,
    detail: redactDetail(input.detail),
  };
  const line = JSON.stringify(event);
  if (event.level === "error") console.error(line);
  else console.info(line);
  return event;
}

const counters = new Map<string, number>();

export function increment(name: string, by = 1): number {
  const next = (counters.get(name) ?? 0) + by;
  counters.set(name, next);
  return next;
}

export function snapshotMetrics(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function resetMetrics(): void {
  counters.clear();
}
