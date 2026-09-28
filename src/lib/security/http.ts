import { createHmac, timingSafeEqual } from "node:crypto";

const AMP = String.fromCharCode(38);

export function securityHeaders(extraCsp?: string): Record<string, string> {
  const csp = extraCsp ?? [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    "content-security-policy": csp,
    "strict-transport-security": "max-age=15552000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-frame-options": "SAMEORIGIN",
  };
}

export function applySecurityHeaders(response: Response, extraCsp?: string): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders(extraCsp))) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

interface Bucket {
  hits: number[];
}

/** Fixed-window counter is wrong under bursts; this keeps timestamps inside the window. */
export class SlidingWindowLimiter {
  private buckets = new Map<string, Bucket>();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    if (limit < 1 || windowMs < 1) throw new Error("Limiter needs a positive limit and window");
    this.limit = limit;
    this.windowMs = windowMs;
  }

  allow(key: string, now = Date.now()): { ok: boolean; retryAfterMs: number; remaining: number } {
    const bucket = this.buckets.get(key) ?? { hits: [] };
    const cutoff = now - this.windowMs;
    bucket.hits = bucket.hits.filter((stamp) => stamp > cutoff);
    if (bucket.hits.length >= this.limit) {
      const oldest = bucket.hits[0] ?? now;
      this.buckets.set(key, bucket);
      return { ok: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now), remaining: 0 };
    }
    bucket.hits.push(now);
    this.buckets.set(key, bucket);
    return { ok: true, retryAfterMs: 0, remaining: this.limit - bucket.hits.length };
  }

  reset(key?: string) {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Double-submit token bound to a session id and an expiry. Not a cookie by itself. */
export function issueCsrfToken(secret: string, sessionId: string, now = Date.now(), ttlMs = 2 * 60 * 60 * 1000): string {
  if (!secret || !sessionId) throw new Error("CSRF token needs a secret and a session");
  const expires = now + ttlMs;
  const payload = `${sessionId}.${expires}`;
  return `${expires}.${sign(secret, payload)}`;
}

export function verifyCsrfToken(secret: string, sessionId: string, token: string, now = Date.now()): boolean {
  const match = /^(\d+)\.([a-f0-9]{64})$/.exec(token);
  if (!match?.[1] || !match[2]) return false;
  const expires = Number(match[1]);
  if (!Number.isFinite(expires) || expires < now) return false;
  const expected = sign(secret, `${sessionId}.${expires}`);
  const left = Buffer.from(expected);
  const right = Buffer.from(match[2]);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const ORIGIN_OK = new Set(["https://meridian.example", "http://localhost:8080", "http://127.0.0.1:8080"]);

export function allowedOrigin(origin: string | null, allowlist: readonly string[] = [...ORIGIN_OK]): boolean {
  if (!origin) return true;
  return allowlist.includes(origin);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, `${AMP}amp;`)
    .replace(/</g, `${AMP}lt;`)
    .replace(/>/g, `${AMP}gt;`)
    .replace(/"/g, `${AMP}quot;`)
    .replace(/'/g, `${AMP}#39;`);
}
