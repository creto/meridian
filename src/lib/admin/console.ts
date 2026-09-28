import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "../identity/passwords.ts";
import { appendAudit, verifyAuditChain, type Queryable } from "../platform/durable.ts";
import { blockedDestination } from "../security/ssrf.ts";

export const CONSOLE_TENANT = "ten_northwind";

export interface ConsoleUser {
  id: string;
  email: string;
  name: string;
  disabled: boolean;
  role: string;
  roles: string[];
  workspaces: string[];
  lastLogin: string | null;
  sessions: number;
}

export interface ConsoleRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface ConsoleJob {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  payloadKeys: string[];
  attempts: number;
  lastError: string | null;
}

export interface ConsoleConnection {
  id: string;
  kind: "storage" | "ecm";
  name: string;
  provider: string;
  secretName: string | null;
  testedAt: string | null;
  configKeys: string[];
}

export interface ConsoleAudit {
  seq: number;
  actor: string;
  action: string;
  target: string;
  at: string;
  hash: string;
  prev: string;
}

export interface ConsoleSnapshot {
  tenantId: string;
  tenants: Array<{ id: string; name: string }>;
  users: ConsoleUser[];
  roles: ConsoleRole[];
  workspaces: Array<{ id: string; name: string }>;
  connections: ConsoleConnection[];
  jobs: ConsoleJob[];
  audit: ConsoleAudit[];
  chain: { ok: boolean; checked: number };
  flags: Array<{ name: string; enabled: boolean; rollout: number | null; scope: string }>;
  webhooks: Array<{ id: string; url: string; enabled: boolean; secretName: string }>;
  apiClients: Array<{ id: string; name: string; role: string; revoked: boolean; publicId: string }>;
  integrations: Array<{ id: string; name: string; kind: string; enabled: boolean }>;
  health: { users: number; forms: number; submissions: number; jobs: number; openTasks: number };
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function keysOf(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).filter((key) => !/secret|password|token|authorization/i.test(key));
}

async function ensureTenant(db: Queryable, tenantId: string): Promise<void> {
  await db.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, tenantId === CONSOLE_TENANT ? "Northwind" : tenantId]);
}

export async function consoleSnapshot(db: Queryable, tenantId = CONSOLE_TENANT): Promise<ConsoleSnapshot> {
  await ensureTenant(db, tenantId);
  const tenants = await db.query<{ id: string; name: string }>("select id, name from tenants order by name");
  const users = await db.query<{ id: string; email: string; name: string; disabled: unknown; role: string; last_login_at: unknown }>(
    "select id, email, name, disabled, role, last_login_at from users where tenant_id = $1 order by email",
    [tenantId],
  );
  const roleRows = await db.query<{ user_id: string; name: string }>(
    `select ur.user_id, r.name from user_roles ur join roles r on r.id = ur.role_id where ur.tenant_id = $1`,
    [tenantId],
  );
  const memberships = await db.query<{ user_id: string; workspace_id: string }>(
    "select user_id, workspace_id from workspace_memberships where tenant_id = $1",
    [tenantId],
  );
  const sessions = await db.query<{ user_id: string; n: unknown }>(
    "select user_id, count(*)::int as n from sessions where tenant_id = $1 and revoked_at is null group by user_id",
    [tenantId],
  );
  const roles = await db.query<{ id: string; name: string }>("select id, name from roles where tenant_id = $1 order by name", [tenantId]);
  const perms = await db.query<{ role_id: string; permission: string }>(
    `select rp.role_id, rp.permission from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = $1`,
    [tenantId],
  );
  const workspaces = await db.query<{ id: string; name: string }>("select id, name from workspaces where tenant_id = $1 order by name", [tenantId]);
  const storage = await db.query<{ id: string; name: string; kind: string; secret_name: string | null; tested_at: unknown; config: unknown }>(
    "select id, name, kind, secret_name, tested_at, config from storage_profiles where tenant_id = $1 order by name",
    [tenantId],
  );
  const ecm = await db.query<{ id: string; name: string; kind: string; secret_name: string | null; tested_at: unknown; config: unknown }>(
    "select id, name, kind, secret_name, tested_at, config from ecm_profiles where tenant_id = $1 order by name",
    [tenantId],
  );
  const jobs = await db.query<{ id: string; queue: string; status: string; payload: unknown; attempts: unknown; last_error: string | null }>(
    "select id, queue, status, payload, attempts, last_error from jobs where tenant_id = $1 order by created_at desc limit 100",
    [tenantId],
  );
  const audit = await db.query<{ seq: unknown; actor: string; action: string; target: string; created_at: unknown; hash: string; prev_hash: string }>(
    "select seq, actor, action, target, created_at, hash, prev_hash from audit_events where tenant_id = $1 order by seq desc limit 50",
    [tenantId],
  );
  const flags = await db.query<{ name: string; enabled: unknown }>("select name, enabled from feature_flags where tenant_id = $1 order by name", [tenantId]);
  const rules = await db.query<{ name: string; scope: string; rollout: unknown; enabled: unknown }>(
    "select name, scope, rollout, enabled from flag_rules where tenant_id = $1",
    [tenantId],
  ).catch(() => []);
  const webhooks = await db.query<{ id: string; url: string; enabled: unknown; secret_name: string }>(
    "select id, url, enabled, secret_name from webhook_endpoints where tenant_id = $1 order by created_at",
    [tenantId],
  );
  const keys = await db.query<{ id: string; name: string; role: string; revoked_at: unknown; public_id: string }>(
    "select id, name, role, revoked_at, public_id from api_keys where tenant_id = $1 order by created_at",
    [tenantId],
  );
  const ai = await db.query<{ provider: string; n: unknown }>(
    "select provider, count(*)::int as n from ai_generations where tenant_id = $1 group by provider",
    [tenantId],
  );
  const chain = await verifyAuditChain(db, tenantId);
  const healthRows = await Promise.all([
    db.query<{ n: unknown }>("select count(*)::int as n from users where tenant_id = $1", [tenantId]),
    db.query<{ n: unknown }>("select count(*)::int as n from forms where tenant_id = $1", [tenantId]),
    db.query<{ n: unknown }>("select count(*)::int as n from submissions where tenant_id = $1", [tenantId]),
    db.query<{ n: unknown }>("select count(*)::int as n from jobs where tenant_id = $1", [tenantId]),
    db.query<{ n: unknown }>("select count(*)::int as n from workflow_tasks where tenant_id = $1 and status = 'open'", [tenantId]),
  ]);
  const sessionCount = new Map(sessions.map((row) => [row.user_id, Number(row.n)]));
  return {
    tenantId,
    tenants,
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      disabled: user.disabled === true || user.disabled === "t" || user.disabled === "true",
      role: user.role,
      roles: roleRows.filter((row) => row.user_id === user.id).map((row) => row.name),
      workspaces: memberships.filter((row) => row.user_id === user.id).map((row) => row.workspace_id),
      lastLogin: asText(user.last_login_at),
      sessions: sessionCount.get(user.id) ?? 0,
    })),
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: perms.filter((row) => row.role_id === role.id).map((row) => row.permission).sort(),
    })),
    workspaces,
    connections: [
      ...storage.map((row) => ({ id: row.id, kind: "storage" as const, name: row.name, provider: row.kind, secretName: row.secret_name, testedAt: asText(row.tested_at), configKeys: keysOf(row.config) })),
      ...ecm.map((row) => ({ id: row.id, kind: "ecm" as const, name: row.name, provider: row.kind, secretName: row.secret_name, testedAt: asText(row.tested_at), configKeys: keysOf(row.config) })),
    ],
    jobs: jobs.map((job) => ({
      id: job.id,
      tenantId,
      type: job.queue,
      status: job.status,
      payloadKeys: keysOf(job.payload),
      attempts: Number(job.attempts ?? 0),
      lastError: job.last_error,
    })),
    audit: audit.map((row) => ({
      seq: Number(row.seq),
      actor: row.actor,
      action: row.action,
      target: row.target,
      at: asText(row.created_at) ?? "",
      hash: row.hash,
      prev: row.prev_hash,
    })).sort((a, b) => a.seq - b.seq),
    chain,
    flags: [
      ...flags.map((flag) => ({ name: flag.name, enabled: flag.enabled === true || flag.enabled === "t" || flag.enabled === "true", rollout: null, scope: "tenant" })),
      ...rules.map((rule) => ({ name: rule.name, enabled: rule.enabled === true || rule.enabled === "t" || rule.enabled === "true", rollout: Number(rule.rollout), scope: rule.scope })),
    ],
    webhooks: webhooks.map((hook) => ({ id: hook.id, url: hook.url, enabled: hook.enabled === true || hook.enabled === "t" || hook.enabled === "true", secretName: hook.secret_name })),
    apiClients: keys.map((key) => ({ id: key.id, name: key.name, role: key.role, revoked: key.revoked_at != null, publicId: key.public_id })),
    integrations: ai.map((row) => ({ id: row.provider, name: row.provider, kind: "ai", enabled: true, calls: Number(row.n) })).map(({ calls: _calls, ...item }) => item),
    health: {
      users: Number(healthRows[0][0]?.n ?? 0),
      forms: Number(healthRows[1][0]?.n ?? 0),
      submissions: Number(healthRows[2][0]?.n ?? 0),
      jobs: Number(healthRows[3][0]?.n ?? 0),
      openTasks: Number(healthRows[4][0]?.n ?? 0),
    },
  };
}

export interface ConsoleCommand {
  action: string;
  actor?: string;
  email?: string;
  name?: string;
  password?: string;
  userId?: string;
  disabled?: boolean;
  role?: string;
  permissions?: string[];
  roleId?: string;
  kind?: "storage" | "ecm";
  provider?: string;
  secretName?: string;
  endpoint?: string;
  jobId?: string;
  flag?: string;
  enabled?: boolean;
  workspaceId?: string;
  workspaceName?: string;
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export async function consoleAct(db: Queryable, tenantId: string, command: ConsoleCommand): Promise<ConsoleSnapshot> {
  await ensureTenant(db, tenantId);
  const actor = command.actor?.trim() || "console";
  if (command.action === "create-user") {
    const email = String(command.email ?? "").trim().toLowerCase();
    const name = String(command.name ?? "").trim();
    const password = String(command.password ?? "");
    if (!email.includes("@") || !name || password.length < 8) throw new Error("Email, name, and a password of at least 8 characters are required");
    const id = newId("usr");
    const passwordHash = await hashPassword(password);
    await db.query(
      "insert into users (id, tenant_id, email, name, password_hash, role) values ($1,$2,$3,$4,$5,$6)",
      [id, tenantId, email, name, passwordHash, command.role || "member"],
    );
    await appendAudit(db, tenantId, { actor, action: "user.create", target: id, detail: email });
  } else if (command.action === "invite-user") {
    const email = String(command.email ?? "").trim().toLowerCase();
    const name = String(command.name ?? "").trim() || email;
    if (!email.includes("@")) throw new Error("Email is required");
    const token = randomBytes(18).toString("base64url");
    const id = newId("usr");
    const hash = createHash("sha256").update(token).digest("hex");
    await db.query(
      "insert into users (id, tenant_id, email, name, password_hash, role) values ($1,$2,$3,$4,$5,$6)",
      [id, tenantId, email, name, `invite$${hash}`, command.role || "member"],
    );
    await appendAudit(db, tenantId, { actor, action: "user.invite", target: id, detail: email });
    const snapshot = await consoleSnapshot(db, tenantId);
    return { ...snapshot, integrations: [...snapshot.integrations, { id: "invite", name: token, kind: "invite-once", enabled: true }] };
  } else if (command.action === "disable-user") {
    await db.query("update users set disabled = $3 where tenant_id = $1 and id = $2", [tenantId, command.userId, Boolean(command.disabled)]);
    if (command.disabled) await db.query("update sessions set revoked_at = now() where tenant_id = $1 and user_id = $2 and revoked_at is null", [tenantId, command.userId]);
    await appendAudit(db, tenantId, { actor, action: command.disabled ? "user.disable" : "user.enable", target: String(command.userId) });
  } else if (command.action === "revoke-sessions") {
    await db.query("update sessions set revoked_at = now() where tenant_id = $1 and user_id = $2 and revoked_at is null", [tenantId, command.userId]);
    await appendAudit(db, tenantId, { actor, action: "session.revoke", target: String(command.userId) });
  } else if (command.action === "assign-role") {
    const roleName = String(command.role ?? "");
    const roleId = newId("rol");
    await db.query("insert into roles (id, tenant_id, name) values ($1,$2,$3) on conflict (tenant_id, name) do nothing", [roleId, tenantId, roleName]);
    const found = await db.query<{ id: string }>("select id from roles where tenant_id = $1 and name = $2", [tenantId, roleName]);
    const id = found[0]?.id;
    if (!id) throw new Error("Role was not stored");
    await db.query(
      "insert into user_roles (tenant_id, user_id, role_id) values ($1,$2,$3) on conflict do nothing",
      [tenantId, command.userId, id],
    );
    await appendAudit(db, tenantId, { actor, action: "role.assign", target: String(command.userId), detail: roleName });
  } else if (command.action === "clone-role") {
    const source = await db.query<{ id: string; name: string }>("select id, name from roles where tenant_id = $1 and id = $2", [tenantId, command.roleId]);
    if (!source[0]) throw new Error("Role not found");
    const id = newId("rol");
    const name = String(command.name ?? `${source[0].name}-copy`);
    await db.query("insert into roles (id, tenant_id, name) values ($1,$2,$3)", [id, tenantId, name]);
    await db.query(
      "insert into role_permissions (role_id, permission) select $2, permission from role_permissions where role_id = $1 on conflict do nothing",
      [source[0].id, id],
    );
    await appendAudit(db, tenantId, { actor, action: "role.clone", target: id, detail: name });
  } else if (command.action === "set-permissions") {
    const permissions = command.permissions ?? [];
    for (const permission of permissions) {
      await db.query("insert into permissions (name) values ($1) on conflict (name) do nothing", [permission]);
      await db.query("insert into role_permissions (role_id, permission) values ($1,$2) on conflict do nothing", [command.roleId, permission]);
    }
    await appendAudit(db, tenantId, { actor, action: "role.permissions", target: String(command.roleId), detail: permissions.join(",") });
  } else if (command.action === "add-workspace") {
    const id = command.workspaceId || newId("ws");
    await db.query("insert into workspaces (id, tenant_id, name) values ($1,$2,$3) on conflict (id) do nothing", [id, tenantId, command.workspaceName || id]);
    if (command.userId) {
      await db.query(
        "insert into workspace_memberships (tenant_id, workspace_id, user_id, role_name) values ($1,$2,$3,$4) on conflict do nothing",
        [tenantId, id, command.userId, command.role || "member"],
      );
    }
    await appendAudit(db, tenantId, { actor, action: "workspace.membership", target: id });
  } else if (command.action === "save-connection") {
    const kind = command.kind === "ecm" ? "ecm" : "storage";
    const table = kind === "ecm" ? "ecm_profiles" : "storage_profiles";
    const secretName = String(command.secretName ?? "");
    if (secretName && !secretName.startsWith("secret:")) throw new Error("Credentials must be a secret reference");
    if (command.endpoint) {
      const blocked = blockedDestination(command.endpoint);
      if (blocked) throw new Error(blocked);
    }
    const id = newId(kind === "ecm" ? "ecm" : "sto");
    const config = JSON.stringify({ endpoint: command.endpoint ?? null });
    await db.query(
      `insert into ${table} (id, tenant_id, name, kind, config, secret_name) values ($1,$2,$3,$4,$5::jsonb,$6)`,
      [id, tenantId, command.name || id, command.provider || "s3", config, secretName || null],
    );
    await appendAudit(db, tenantId, { actor, action: `${kind}.save`, target: id });
  } else if (command.action === "test-connection") {
    const storage = await db.query<{ id: string; config: unknown }>("select id, config from storage_profiles where tenant_id = $1 and id = $2", [tenantId, command.roleId]);
    const ecm = storage[0] ? null : await db.query<{ id: string; config: unknown }>("select id, config from ecm_profiles where tenant_id = $1 and id = $2", [tenantId, command.roleId]);
    const row = storage[0] ?? ecm?.[0];
    if (!row) throw new Error("Connection not found");
    const endpoint = row.config && typeof row.config === "object" ? String((row.config as { endpoint?: string }).endpoint ?? "") : "";
    if (endpoint) {
      const blocked = blockedDestination(endpoint);
      if (blocked) throw new Error(blocked);
    }
    const table = storage[0] ? "storage_profiles" : "ecm_profiles";
    await db.query(`update ${table} set tested_at = now() where id = $1 and tenant_id = $2`, [row.id, tenantId]);
    await appendAudit(db, tenantId, { actor, action: "connection.test", target: row.id, detail: endpoint ? "endpoint-shape-ok" : "no-endpoint" });
  } else if (command.action === "retry-job") {
    await db.query("update jobs set status = 'queued', run_at = now(), updated_at = now() where tenant_id = $1 and id = $2 and status = 'dead'", [tenantId, command.jobId]);
    await appendAudit(db, tenantId, { actor, action: "job.retry", target: String(command.jobId) });
  } else if (command.action === "cancel-job") {
    await db.query("update jobs set status = 'cancelled', updated_at = now() where tenant_id = $1 and id = $2 and status in ('queued', 'retry')", [tenantId, command.jobId]);
    await appendAudit(db, tenantId, { actor, action: "job.cancel", target: String(command.jobId) });
  } else if (command.action === "set-flag") {
    await db.query(
      "insert into feature_flags (tenant_id, name, enabled) values ($1,$2,$3) on conflict (tenant_id, name) do update set enabled = excluded.enabled",
      [tenantId, command.flag, Boolean(command.enabled)],
    );
    await appendAudit(db, tenantId, { actor, action: "flag.set", target: String(command.flag), detail: String(Boolean(command.enabled)) });
  } else if (command.action === "export-audit") {
    await appendAudit(db, tenantId, { actor, action: "audit.export", target: "audit_events" });
  } else {
    throw new Error(`Unknown console action ${command.action}`);
  }
  return consoleSnapshot(db, tenantId);
}

/** The invite token is returned once on the integrations list as kind invite-once. Callers must not persist that row. */
export function takeInviteToken(snapshot: ConsoleSnapshot): { snapshot: ConsoleSnapshot; token: string | null } {
  const invite = snapshot.integrations.find((item) => item.kind === "invite-once");
  return {
    token: invite?.name ?? null,
    snapshot: { ...snapshot, integrations: snapshot.integrations.filter((item) => item.kind !== "invite-once") },
  };
}
