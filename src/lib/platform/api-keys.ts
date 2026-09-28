import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Queryable } from "./durable.ts";

export interface IssuedKey {
  id: string;
  publicId: string;
  /** Shown once. Not stored. */
  secret: string;
  tenantId: string;
  role: string;
  scopes: string[];
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function equalHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function issueApiKey(
  db: Queryable,
  input: { tenantId: string; name: string; role?: string; scopes?: string[]; expiresAt?: string | null; workspaceId?: string | null },
): Promise<IssuedKey> {
  const publicId = `mk_${randomBytes(6).toString("hex")}`;
  const secret = randomBytes(24).toString("base64url");
  const id = `key_${randomBytes(8).toString("hex")}`;
  await db.query(
    `insert into api_keys (id, tenant_id, name, public_id, secret_hash, scopes, expires_at, role, workspace_id)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
    [
      id,
      input.tenantId,
      input.name,
      publicId,
      hashSecret(secret),
      JSON.stringify(input.scopes ?? ["agent.execute"]),
      input.expiresAt ?? null,
      input.role ?? "agent",
      input.workspaceId ?? null,
    ],
  );
  return { id, publicId, secret, tenantId: input.tenantId, role: input.role ?? "agent", scopes: input.scopes ?? ["agent.execute"] };
}

export async function authenticatePresentedKey(
  db: Queryable,
  presented: string,
): Promise<{ tenantId: string; publicId: string; role: string; scopes: string[] } | null> {
  const marker = presented.indexOf(".");
  if (marker < 0) return null;
  const publicId = presented.slice(0, marker);
  const secret = presented.slice(marker + 1);
  const rows = await db.query<{
    tenant_id: string;
    secret_hash: string;
    role: string;
    scopes: string[] | string;
    expires_at: string | null;
    revoked_at: string | null;
  }>("select tenant_id, secret_hash, role, scopes, expires_at, revoked_at from api_keys where public_id = $1", [publicId]);
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null;
  if (!equalHex(row.secret_hash, hashSecret(secret))) return null;
  await db.query("update api_keys set last_used_at = now() where public_id = $1", [publicId]);
  const scopes = typeof row.scopes === "string" ? (JSON.parse(row.scopes) as string[]) : row.scopes;
  return { tenantId: row.tenant_id, publicId, role: row.role, scopes };
}

/** Presentation form stored nowhere: publicId.secret */
export function present(key: IssuedKey): string {
  return `${key.publicId}.${key.secret}`;
}

export async function rotateApiKey(db: Queryable, tenantId: string, publicId: string): Promise<IssuedKey | null> {
  const rows = await db.query<{ id: string; name: string; role: string; scopes: string[] | string; workspace_id: string | null }>(
    "select id, name, role, scopes, workspace_id from api_keys where public_id = $1 and tenant_id = $2 and revoked_at is null",
    [publicId, tenantId],
  );
  const current = rows[0];
  if (!current) return null;
  await db.query("update api_keys set revoked_at = now() where id = $1 and tenant_id = $2", [current.id, tenantId]);
  const scopes = typeof current.scopes === "string" ? (JSON.parse(current.scopes) as string[]) : current.scopes;
  const next = await issueApiKey(db, {
    tenantId,
    name: current.name,
    role: current.role,
    scopes,
    workspaceId: current.workspace_id,
  });
  await db.query("update api_keys set rotated_from = $2 where id = $1", [next.id, publicId]);
  return next;
}

export async function revokeApiKey(db: Queryable, tenantId: string, publicId: string): Promise<boolean> {
  const rows = await db.query(
    "update api_keys set revoked_at = now() where public_id = $1 and tenant_id = $2 and revoked_at is null returning id",
    [publicId, tenantId],
  );
  return rows.length > 0;
}
