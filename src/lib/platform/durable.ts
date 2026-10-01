import { auditHash, decryptSecret, encryptSecret, hashApiSecret, randomToken, sha256Text } from "./crypto.ts";
import { hashPassword, verifyPassword } from "../identity/passwords.ts";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface WorkspacePayload {
  revision: number;
  forms: unknown[];
  submissions: unknown[];
  idempotency: unknown[];
  connections?: unknown[];
  audit?: unknown[];
  webhooks?: unknown[];
}

const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000];

export async function seedPlatform(db: Queryable, masterKey: Buffer, password = "meridian-demo"): Promise<void> {
  const tenants = [
    { id: "ten_northwind", name: "Northwind" },
    { id: "ten_contoso", name: "Contoso" },
  ];
  for (const tenant of tenants) {
    await db.query(
      "insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing",
      [tenant.id, tenant.name],
    );
  }
  const users = [
    { id: "usr_ada", tenantId: "ten_northwind", email: "ada@northwind.example", name: "Ada North", role: "owner" },
    { id: "usr_ben", tenantId: "ten_contoso", email: "ben@contoso.example", name: "Ben Contoso", role: "owner" },
  ];
  const passwordHash = await hashPassword(password);
  for (const user of users) {
    await db.query(
      `insert into users (id, tenant_id, email, name, password_hash, role)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do nothing`,
      [user.id, user.tenantId, user.email, user.name, passwordHash, user.role],
    );
  }
  await putSecret(db, masterKey, "ten_northwind", "demo-note", "northwind-only");
  await putSecret(db, masterKey, "ten_contoso", "demo-note", "contoso-only");
}

export async function login(db: Queryable, email: string, password: string): Promise<{ token: string; tenantId: string; userId: string; role: string } | null> {
  const rows = await db.query<{ id: string; tenant_id: string; password_hash: string; role: string; disabled: boolean; locked: boolean }>(
    "select id, tenant_id, password_hash, role, disabled, locked from users where email = $1",
    [email.toLowerCase()],
  );
  const user = rows[0];
  if (!user || user.disabled || user.locked) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;
  const token = randomToken();
  const id = `ses_${randomToken(8)}`;
  await db.query(
    "insert into sessions (id, user_id, tenant_id, token_hash, expires_at) values ($1, $2, $3, $4, now() + interval '12 hours')",
    [id, user.id, user.tenant_id, sha256Text(token)],
  );
  await db.query("update users set last_login_at = now() where id = $1", [user.id]);
  await appendAudit(db, user.tenant_id, { actor: user.id, action: "auth.login", target: user.id });
  return { token, tenantId: user.tenant_id, userId: user.id, role: user.role };
}

export async function sessionTenant(db: Queryable, token: string): Promise<{ tenantId: string; userId: string } | null> {
  const rows = await db.query<{ tenant_id: string; user_id: string }>(
    "select tenant_id, user_id from sessions where token_hash = $1 and expires_at > now()",
    [sha256Text(token)],
  );
  const row = rows[0];
  return row ? { tenantId: row.tenant_id, userId: row.user_id } : null;
}

export async function createApiKey(db: Queryable, tenantId: string, name: string, scopes: string[]): Promise<{ token: string; publicId: string }> {
  const publicId = sha256Text(randomToken()).slice(0, 16);
  const secret = randomToken(24);
  const token = `mdn_live_${publicId}_${secret}`;
  await db.query(
    "insert into api_keys (id, tenant_id, name, public_id, secret_hash, scopes) values ($1, $2, $3, $4, $5, $6::jsonb)",
    [`key_${publicId}`, tenantId, name, publicId, hashApiSecret(secret), JSON.stringify(scopes)],
  );
  await appendAudit(db, tenantId, { actor: "system", action: "api_key.create", target: publicId, detail: name });
  return { token, publicId };
}

export async function authenticateApiKey(db: Queryable, token: string): Promise<{ tenantId: string; scopes: string[] } | null> {
  const match = /^mdn_live_([^_]+)_(.+)$/.exec(token);
  if (!match) return null;
  const publicId = match[1]!;
  const secret = match[2]!;
  const rows = await db.query<{ tenant_id: string; secret_hash: string; scopes: string[] | string; revoked_at: string | null }>(
    "select tenant_id, secret_hash, scopes, revoked_at from api_keys where public_id = $1",
    [publicId],
  );
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  if (row.secret_hash !== hashApiSecret(secret)) return null;
  await db.query("update api_keys set last_used_at = now() where public_id = $1", [publicId]);
  const scopes = typeof row.scopes === "string" ? JSON.parse(row.scopes) as string[] : row.scopes;
  return { tenantId: row.tenant_id, scopes };
}

export async function revokeApiKey(db: Queryable, tenantId: string, publicId: string): Promise<boolean> {
  const rows = await db.query(
    "update api_keys set revoked_at = now() where public_id = $1 and tenant_id = $2 and revoked_at is null returning id",
    [publicId, tenantId],
  );
  return rows.length > 0;
}

export async function putSecret(db: Queryable, masterKey: Buffer, tenantId: string, name: string, value: string): Promise<void> {
  const sealed = encryptSecret(value, masterKey);
  await db.query(
    `insert into secret_refs (id, tenant_id, name, ciphertext, iv, auth_tag)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (tenant_id, name) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, auth_tag = excluded.auth_tag`,
    [`sec_${sha256Text(`${tenantId}:${name}`).slice(0, 16)}`, tenantId, name, sealed.ciphertext, sealed.iv, sealed.authTag],
  );
}

export async function getSecret(db: Queryable, masterKey: Buffer, tenantId: string, name: string): Promise<string | null> {
  const rows = await db.query<{ ciphertext: string; iv: string; auth_tag: string }>(
    "select ciphertext, iv, auth_tag from secret_refs where tenant_id = $1 and name = $2",
    [tenantId, name],
  );
  const row = rows[0];
  if (!row) return null;
  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag }, masterKey);
}

export function workspaceHash(payload: WorkspacePayload): string {
  return sha256Text(JSON.stringify({
    forms: payload.forms,
    submissions: payload.submissions,
    idempotency: payload.idempotency,
    connections: payload.connections ?? [],
    webhooks: payload.webhooks ?? [],
  }));
}

export async function saveWorkspace(db: Queryable, tenantId: string, payload: WorkspacePayload): Promise<void> {
  const hash = workspaceHash(payload);
  await db.query(
    `insert into workspace_state (tenant_id, revision, content_hash, payload, updated_at)
     values ($1, $2, $3, $4::jsonb, now())
     on conflict (tenant_id) do update set revision = excluded.revision, content_hash = excluded.content_hash, payload = excluded.payload, updated_at = now()`,
    [tenantId, payload.revision, hash, JSON.stringify(payload)],
  );
}

export async function loadWorkspace(db: Queryable, tenantId: string): Promise<WorkspacePayload | null> {
  const rows = await db.query<{ payload: WorkspacePayload | string }>(
    "select payload from workspace_state where tenant_id = $1",
    [tenantId],
  );
  const row = rows[0];
  if (!row) return null;
  return typeof row.payload === "string" ? JSON.parse(row.payload) as WorkspacePayload : row.payload;
}

export async function appendAudit(db: Queryable, tenantId: string, event: { actor: string; action: string; target: string; detail?: string }): Promise<string> {
  const prior = await db.query<{ seq: number; hash: string }>(
    "select seq, hash from audit_events where tenant_id = $1 order by seq desc limit 1",
    [tenantId],
  );
  const seq = Number(prior[0]?.seq ?? 0) + 1;
  const prevHash = prior[0]?.hash ?? "genesis";
  const hash = auditHash({ seq, tenantId, actor: event.actor, action: event.action, target: event.target, detail: event.detail, prevHash });
  await db.query(
    "insert into audit_events (id, tenant_id, seq, actor, action, target, detail, prev_hash, hash) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [`aud_${tenantId}_${seq}`, tenantId, seq, event.actor, event.action, event.target, event.detail ?? null, prevHash, hash],
  );
  return hash;
}

export async function verifyAuditChain(db: Queryable, tenantId: string): Promise<{ ok: boolean; checked: number }> {
  const rows = await db.query<{ seq: number; actor: string; action: string; target: string; detail: string | null; prev_hash: string; hash: string }>(
    "select seq, actor, action, target, detail, prev_hash, hash from audit_events where tenant_id = $1 order by seq",
    [tenantId],
  );
  let prev = "genesis";
  for (const row of rows) {
    const expected = auditHash({
      seq: Number(row.seq),
      tenantId,
      actor: row.actor,
      action: row.action,
      target: row.target,
      detail: row.detail ?? undefined,
      prevHash: prev,
    });
    if (row.prev_hash !== prev || row.hash !== expected) return { ok: false, checked: Number(row.seq) };
    prev = row.hash;
  }
  return { ok: true, checked: rows.length };
}

export async function enqueueJob(db: Queryable, tenantId: string, queue: string, payload: unknown, runAt = new Date()): Promise<string> {
  const id = `job_${randomToken(8)}`;
  await db.query(
    "insert into jobs (id, tenant_id, queue, status, payload, run_at) values ($1, $2, $3, 'queued', $4::jsonb, $5)",
    [id, tenantId, queue, JSON.stringify(payload), runAt.toISOString()],
  );
  return id;
}

export async function claimDueJobs(db: Queryable, limit = 10): Promise<{ id: string; tenant_id: string; queue: string; payload: unknown; attempts: number }[]> {
  return db.query(
    `with next as (
       select id from jobs
       where status = 'queued' and run_at <= now()
       order by run_at
       for update skip locked
       limit $1
     )
     update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
     from next where jobs.id = next.id
     returning jobs.id, jobs.tenant_id, jobs.queue, jobs.payload, jobs.attempts`,
    [limit],
  );
}

export async function finishJob(db: Queryable, id: string, ok: boolean, error?: string): Promise<void> {
  if (ok) {
    await db.query("update jobs set status = 'completed', updated_at = now(), last_error = null where id = $1", [id]);
    return;
  }
  const rows = await db.query<{ attempts: number; max_attempts: number }>("select attempts, max_attempts from jobs where id = $1", [id]);
  const row = rows[0];
  const dead = !row || row.attempts >= row.max_attempts;
  await db.query(
    "update jobs set status = $2, last_error = $3, updated_at = now(), run_at = now() + interval '1 minute' where id = $1",
    [id, dead ? "dead" : "queued", error ?? "failed"],
  );
}

export function nextWebhookDelay(attempts: number): number | null {
  return BACKOFF_MS[attempts] ?? null;
}

export async function enqueueWebhook(db: Queryable, tenantId: string, endpointId: string, event: string, payload: unknown): Promise<string> {
  const id = `whd_${randomToken(8)}`;
  await db.query(
    "insert into webhook_deliveries (id, tenant_id, endpoint_id, event, payload, status, next_attempt_at) values ($1, $2, $3, $4, $5::jsonb, 'queued', now())",
    [id, tenantId, endpointId, event, JSON.stringify(payload)],
  );
  return id;
}

export async function recordWebhookAttempt(db: Queryable, id: string, ok: boolean, error?: string): Promise<"delivered" | "retry" | "dead"> {
  const rows = await db.query<{ attempts: number }>("select attempts from webhook_deliveries where id = $1", [id]);
  const attempts = Number(rows[0]?.attempts ?? 0) + 1;
  if (ok) {
    await db.query("update webhook_deliveries set status = 'delivered', attempts = $2, last_error = null where id = $1", [id, attempts]);
    return "delivered";
  }
  const delay = nextWebhookDelay(attempts - 1);
  if (delay == null) {
    await db.query("update webhook_deliveries set status = 'dead', attempts = $2, last_error = $3 where id = $1", [id, attempts, error ?? "failed"]);
    return "dead";
  }
  await db.query(
    "update webhook_deliveries set status = 'retry', attempts = $2, last_error = $3, next_attempt_at = now() + ($4 || ' milliseconds')::interval where id = $1",
    [id, attempts, error ?? "failed", String(delay)],
  );
  return "retry";
}
