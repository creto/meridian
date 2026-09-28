import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

export interface PrefillClaims {
  tenantId: string;
  formId: string;
  exp: number;
  fields: Record<string, string>;
  protectedFields: string[];
}

function b64url(bytes: Buffer | string): string {
  const buf = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  return buf.toString("base64url");
}

export function signPrefill(claims: PrefillClaims, secret: string): string {
  const payload = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", secret).update(payload).digest();
  return `v1.${payload}.${b64url(sig)}`;
}

export function verifyPrefill(token: string, secret: string, nowMs: number): { ok: true; claims: PrefillClaims } | { ok: false; code: string } {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) return { ok: false, code: "FORMAT" };
  const expected = createHmac("sha256", secret).update(parts[1]).digest("base64url");
  const left = Buffer.from(expected);
  const right = Buffer.from(parts[2]);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false, code: "SIGNATURE" };
  let claims: PrefillClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as PrefillClaims;
  } catch {
    return { ok: false, code: "PAYLOAD" };
  }
  if (!claims.exp || claims.exp < nowMs) return { ok: false, code: "EXPIRED" };
  if (!claims.tenantId || !claims.formId) return { ok: false, code: "BINDING" };
  return { ok: true, claims };
}

export function mergePrefill(
  tokenFields: Record<string, string>,
  query: Record<string, string>,
  protectedFields: string[],
): { data: Record<string, string>; rejectedKeys: string[] } {
  const rejected: string[] = [];
  const data = { ...tokenFields };
  const locked = new Set(protectedFields);
  for (const [key, value] of Object.entries(query)) {
    if (locked.has(key)) {
      rejected.push(key);
      continue;
    }
    data[key] = value;
  }
  for (const key of protectedFields) {
    if (key in tokenFields) data[key] = tokenFields[key]!;
  }
  return { data, rejectedKeys: rejected };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function storePrefillHash(db: Queryable, token: string, claims: PrefillClaims): Promise<void> {
  await db.query(
    `insert into prefill_tokens (token_hash, tenant_id, form_id, expires_at, fields, protected_fields)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
    [hashToken(token), claims.tenantId, claims.formId, new Date(claims.exp).toISOString(), JSON.stringify(claims.fields), JSON.stringify(claims.protectedFields)],
  );
}

export function newLinkToken(): string {
  return randomBytes(18).toString("base64url");
}
