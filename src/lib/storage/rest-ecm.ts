import { blockedDestination } from "../security/ssrf.ts";

export interface RestEcmMapping {
  method: string;
  urlTemplate: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  multipart: boolean;
  jsonBody?: Record<string, string>;
  documentIdPath: string;
  urlPath?: string;
  metadata?: Record<string, string>;
  retryDelaysMs: number[];
  secretRefs: Record<string, string>;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  if (template.includes("\r") || template.includes("\n")) throw new Error("Template contains a line break");
  const rendered = template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value == null) throw new Error(`Missing template var ${key}`);
    if (/[\r\n]/.test(value)) throw new Error(`Var ${key} contains a line break`);
    return encodeURIComponent(value);
  });
  if (rendered.startsWith("//")) throw new Error("Protocol-relative URL");
  return rendered;
}

export function buildRestEcmRequest(mapping: RestEcmMapping, vars: Record<string, string>, secrets: Record<string, string>): {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
} {
  const url = new URL(renderTemplate(mapping.urlTemplate, vars));
  for (const [key, value] of Object.entries(mapping.query ?? {})) url.searchParams.set(key, renderTemplate(value, vars));
  const blocked = blockedDestination(url.toString());
  if (blocked) throw new Error(blocked);
  const headers: Record<string, string> = { ...(mapping.headers ?? {}) };
  for (const [header, secretName] of Object.entries(mapping.secretRefs)) {
    const secret = secrets[secretName];
    if (!secret) throw new Error(`Missing secret ${secretName}`);
    headers[header] = secret;
  }
  let body: string | null = null;
  if (mapping.jsonBody) {
    const filled: Record<string, string> = {};
    for (const [key, template] of Object.entries(mapping.jsonBody)) filled[key] = renderTemplate(template, vars);
    body = JSON.stringify({ ...filled, metadata: mapping.metadata ?? {} });
    headers["content-type"] = headers["content-type"] ?? "application/json";
  }
  return { url: url.toString(), method: mapping.method.toUpperCase(), headers, body };
}

export function normalizeEcmError(status: number, body: string): { code: string; retryable: boolean; message: string } {
  const message = body.slice(0, 300) || `HTTP ${status}`;
  if (status === 401 || status === 403) return { code: "AUTH", retryable: false, message };
  if (status === 404) return { code: "NOT_FOUND", retryable: false, message };
  if (status === 429 || status >= 500) return { code: "RETRY", retryable: true, message };
  return { code: "REJECTED", retryable: false, message };
}

export function nextRetryDelay(delays: number[], attempt: number): number | null {
  if (attempt < 0 || attempt >= delays.length) return null;
  return delays[attempt] ?? null;
}

export function readPath(body: unknown, path: string): string | null {
  let current = body;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current == null ? null : String(current);
}
