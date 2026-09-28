import { createHash, randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function ensureTenant(db: Queryable, tenantId: string) {
  await db.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, tenantId]);
}

export interface DraftRecord {
  id: string;
  tenantId: string;
  formId: string;
  data: Record<string, unknown>;
  expiresAt: string;
}

export async function saveSubmissionDraft(
  db: Queryable,
  tenantId: string,
  formId: string,
  data: Record<string, unknown>,
  ttlMs = 7 * 24 * 60 * 60 * 1000,
): Promise<{ id: string; token: string; expiresAt: string }> {
  await ensureTenant(db, tenantId);
  const id = `dft_${randomBytes(8).toString("hex")}`;
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.query(
    `insert into submission_drafts (id, tenant_id, form_id, resume_token_hash, data, expires_at)
     values ($1,$2,$3,$4,$5::jsonb,$6)`,
    [id, tenantId, formId, sha(token), JSON.stringify(data), expiresAt],
  );
  return { id, token, expiresAt };
}

export async function loadSubmissionDraft(db: Queryable, tenantId: string, token: string, now = new Date()): Promise<DraftRecord | null> {
  const rows = await db.query<{ id: string; tenant_id: string; form_id: string; data: Record<string, unknown> | string; expires_at: string | Date; revoked_at: string | null }>(
    `select id, tenant_id, form_id, data, expires_at, revoked_at
     from submission_drafts where resume_token_hash = $1 and tenant_id = $2`,
    [sha(token), tenantId],
  );
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  const expires = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  if (expires.getTime() <= now.getTime()) return null;
  const data = typeof row.data === "string" ? JSON.parse(row.data) as Record<string, unknown> : row.data;
  return { id: row.id, tenantId: row.tenant_id, formId: row.form_id, data, expiresAt: expires.toISOString() };
}

export async function revokeSubmissionDraft(db: Queryable, tenantId: string, id: string): Promise<boolean> {
  const rows = await db.query(
    "update submission_drafts set revoked_at = now() where id = $1 and tenant_id = $2 and revoked_at is null returning id",
    [id, tenantId],
  );
  return rows.length > 0;
}
