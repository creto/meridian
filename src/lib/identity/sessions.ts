import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { appendAudit } from "../platform/durable.ts";
import { verifyPassword } from "./passwords.ts";

const WINDOW_MS = 12 * 60 * 60 * 1000;
const LOCK_AFTER = 5;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export interface SessionRecord {
  sessionId: string;
  token: string;
  userId: string;
  tenantId: string;
  expiresAt: string;
}

export async function loginUser(
  db: Queryable,
  input: { email: string; password: string },
): Promise<{ ok: true; session: SessionRecord } | { ok: false; code: "UNKNOWN" | "DISABLED" | "LOCKED" | "BAD_PASSWORD" }> {
  const rows = await db.query<{
    id: string;
    tenant_id: string;
    password_hash: string;
    disabled: boolean;
    locked: boolean;
    failed_logins: number;
    locked_until: string | Date | null;
  }>("select id, tenant_id, password_hash, disabled, locked, failed_logins, locked_until from users where email = $1", [input.email.toLowerCase()]);
  const user = rows[0];
  if (!user) return { ok: false, code: "UNKNOWN" };
  if (user.disabled) return { ok: false, code: "DISABLED" };
  if (user.locked_until && Date.parse(String(user.locked_until)) > Date.now()) return { ok: false, code: "LOCKED" };
  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) {
    const failed = Number(user.failed_logins ?? 0) + 1;
    const lock = failed >= LOCK_AFTER;
    await db.query(
      `update users set failed_logins = $2, locked = $3, locked_until = $4 where id = $1`,
      [user.id, failed, lock, lock ? new Date(Date.now() + 15 * 60_000).toISOString() : null],
    );
    await appendAudit(db, user.tenant_id, { actor: user.id, action: "login.failed", target: user.id, detail: `attempt ${failed}` });
    return { ok: false, code: lock ? "LOCKED" : "BAD_PASSWORD" };
  }
  await db.query("update users set failed_logins = 0, locked = false, locked_until = null, last_login_at = now() where id = $1", [user.id]);
  const token = randomBytes(32).toString("base64url");
  const sessionId = `ses_${randomBytes(8).toString("hex")}`;
  const expires = new Date(Date.now() + WINDOW_MS).toISOString();
  await db.query(
    `insert into sessions (id, user_id, tenant_id, token_hash, expires_at, last_seen_at) values ($1,$2,$3,$4,$5, now())`,
    [sessionId, user.id, user.tenant_id, hashToken(token), expires],
  );
  await appendAudit(db, user.tenant_id, { actor: user.id, action: "login", target: sessionId });
  return { ok: true, session: { sessionId, token, userId: user.id, tenantId: user.tenant_id, expiresAt: expires } };
}

export async function readSession(db: Queryable, token: string): Promise<{ userId: string; tenantId: string; sessionId: string } | null> {
  const rows = await db.query<{ id: string; user_id: string; tenant_id: string; token_hash: string; expires_at: string | Date; revoked_at: string | Date | null }>(
    "select id, user_id, tenant_id, token_hash, expires_at, revoked_at from sessions where token_hash = $1",
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  if (Date.parse(String(row.expires_at)) <= Date.now()) return null;
  if (!same(row.token_hash, hashToken(token))) return null;
  await db.query("update sessions set last_seen_at = now() where id = $1", [row.id]);
  return { userId: row.user_id, tenantId: row.tenant_id, sessionId: row.id };
}

export async function revokeSession(db: Queryable, token: string): Promise<boolean> {
  const rows = await db.query<{ id: string; tenant_id: string; user_id: string }>(
    "update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null returning id, tenant_id, user_id",
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return false;
  await appendAudit(db, row.tenant_id, { actor: row.user_id, action: "logout", target: row.id });
  return true;
}
