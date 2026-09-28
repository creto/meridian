import { randomBytes } from "node:crypto";

/** Rows-only query surface. Callers pass PGlite or node-pg; this module never calls getSql(). */
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export class DirectoryError extends Error {
  readonly code: "DUPLICATE";

  constructor(message: string) {
    super(message);
    this.name = "DirectoryError";
    this.code = "DUPLICATE";
  }
}

export interface DirectoryUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: string;
}

export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  failed_logins: number;
  last_login_at: string | null;
}

export interface AuditEntry {
  actor: string;
  action: string;
  target: string;
  detail: string | null;
  seq: number;
}

export interface HealthCounts {
  users: number;
  forms: number;
  submissions: number;
  jobs: number;
  openTasks: number;
}

const AUDIT_LIMIT = 200;

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function pgCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }
  return undefined;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "t" || text === "true" || text === "1" || text === "yes";
  }
  return false;
}

function asTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text === "" ? null : text;
}

async function ensureTenant(db: Queryable, tenantId: string): Promise<void> {
  await db.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, tenantId]);
}

function capLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 0;
  const truncated = Math.trunc(limit);
  if (truncated <= 0) return 0;
  return Math.min(truncated, AUDIT_LIMIT);
}

async function countWhere(db: Queryable, sql: string, tenantId: string): Promise<number> {
  const rows = await db.query<{ n: unknown }>(sql, [tenantId]);
  return asNumber(rows[0]?.n);
}

export async function createDirectoryUser(db: Queryable, tenantId: string, input: DirectoryUserInput): Promise<{ id: string }> {
  await ensureTenant(db, tenantId);
  const email = input.email.trim().toLowerCase();
  const id = newId("usr");
  try {
    await db.query(
      `insert into users (id, tenant_id, email, name, password_hash, role)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, email, input.name, input.passwordHash, input.role],
    );
  } catch (error) {
    if (pgCode(error) === "23505") {
      throw new DirectoryError(`duplicate email ${email}`);
    }
    throw error;
  }
  return { id };
}

export async function listDirectoryUsers(db: Queryable, tenantId: string): Promise<DirectoryUser[]> {
  await ensureTenant(db, tenantId);
  const rows = await db.query<{
    id: string;
    email: string;
    name: string;
    role: string;
    disabled: unknown;
    failed_logins: unknown;
    last_login_at: unknown;
  }>(
    `select id, email, name, role, disabled, failed_logins, last_login_at
     from users
     where tenant_id = $1
     order by email asc, id asc`,
    [tenantId],
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    disabled: asBoolean(row.disabled),
    failed_logins: asNumber(row.failed_logins),
    last_login_at: asTimestamp(row.last_login_at),
  }));
}

export async function setUserDisabled(db: Queryable, tenantId: string, userId: string, disabled: boolean): Promise<boolean> {
  await ensureTenant(db, tenantId);
  const rows = await db.query<{ id: string }>(
    "update users set disabled = $3 where tenant_id = $1 and id = $2 returning id",
    [tenantId, userId, disabled],
  );
  return rows.length > 0;
}

export async function ensureRole(db: Queryable, tenantId: string, name: string): Promise<string> {
  await ensureTenant(db, tenantId);
  const id = newId("rol");
  const inserted = await db.query<{ id: string }>(
    `insert into roles (id, tenant_id, name)
     values ($1, $2, $3)
     on conflict (tenant_id, name) do nothing
     returning id`,
    [id, tenantId, name],
  );
  if (inserted[0]?.id) return inserted[0].id;
  const existing = await db.query<{ id: string }>("select id from roles where tenant_id = $1 and name = $2", [tenantId, name]);
  if (!existing[0]) throw new Error(`role ${name} was not stored for ${tenantId}`);
  return existing[0].id;
}

export async function grantPermission(db: Queryable, tenantId: string, roleName: string, permission: string): Promise<boolean> {
  await ensureTenant(db, tenantId);
  const roles = await db.query<{ id: string }>("select id from roles where tenant_id = $1 and name = $2", [tenantId, roleName]);
  const role = roles[0];
  if (!role) return false;
  await db.query("insert into permissions (name) values ($1) on conflict (name) do nothing", [permission]);
  await db.query(
    "insert into role_permissions (role_id, permission) values ($1, $2) on conflict (role_id, permission) do nothing",
    [role.id, permission],
  );
  return true;
}

export async function assignUserRole(db: Queryable, tenantId: string, userId: string, roleName: string): Promise<boolean> {
  await ensureTenant(db, tenantId);
  const users = await db.query<{ id: string }>("select id from users where tenant_id = $1 and id = $2", [tenantId, userId]);
  if (!users[0]) return false;
  const roles = await db.query<{ id: string }>("select id from roles where tenant_id = $1 and name = $2", [tenantId, roleName]);
  const role = roles[0];
  if (!role) return false;
  await db.query(
    `insert into user_roles (tenant_id, user_id, role_id)
     values ($1, $2, $3)
     on conflict (tenant_id, user_id, role_id) do nothing`,
    [tenantId, userId, role.id],
  );
  return true;
}

export async function setFlag(db: Queryable, tenantId: string, name: string, enabled: boolean): Promise<void> {
  await ensureTenant(db, tenantId);
  await db.query(
    `insert into feature_flags (tenant_id, name, enabled)
     values ($1, $2, $3)
     on conflict (tenant_id, name) do update set enabled = excluded.enabled`,
    [tenantId, name, enabled],
  );
}

export async function getFlag(db: Queryable, tenantId: string, name: string): Promise<boolean> {
  await ensureTenant(db, tenantId);
  const rows = await db.query<{ enabled: unknown }>("select enabled from feature_flags where tenant_id = $1 and name = $2", [tenantId, name]);
  if (!rows[0]) return false;
  return asBoolean(rows[0].enabled);
}

export async function trackAnalytics(
  db: Queryable,
  tenantId: string,
  name: string,
  subject: string | null,
  properties: Record<string, unknown>,
): Promise<{ id: string }> {
  await ensureTenant(db, tenantId);
  const id = newId("anl");
  const payload = JSON.stringify(properties ?? {});
  await db.query(
    `insert into analytics_events (id, tenant_id, name, subject, properties)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [id, tenantId, name, subject, payload],
  );
  return { id };
}

export async function analyticsCount(db: Queryable, tenantId: string, name: string): Promise<number> {
  await ensureTenant(db, tenantId);
  const rows = await db.query<{ n: unknown }>(
    "select count(*)::int as n from analytics_events where tenant_id = $1 and name = $2",
    [tenantId, name],
  );
  return asNumber(rows[0]?.n);
}

export async function recentAudit(db: Queryable, tenantId: string, limit: number): Promise<AuditEntry[]> {
  await ensureTenant(db, tenantId);
  const capped = capLimit(limit);
  if (capped === 0) return [];
  const rows = await db.query<{
    actor: string;
    action: string;
    target: string;
    detail: string | null;
    seq: unknown;
  }>(
    `select actor, action, target, detail, seq
     from audit_events
     where tenant_id = $1
     order by seq desc
     limit $2`,
    [tenantId, capped],
  );
  return rows.map((row) => ({
    actor: row.actor,
    action: row.action,
    target: row.target,
    detail: row.detail == null ? null : String(row.detail),
    seq: asNumber(row.seq),
  }));
}

export async function healthCounts(db: Queryable, tenantId: string): Promise<HealthCounts> {
  await ensureTenant(db, tenantId);
  const [users, forms, submissions, jobs, openTasks] = await Promise.all([
    countWhere(db, "select count(*)::int as n from users where tenant_id = $1", tenantId),
    countWhere(db, "select count(*)::int as n from forms where tenant_id = $1", tenantId),
    countWhere(db, "select count(*)::int as n from submissions where tenant_id = $1", tenantId),
    countWhere(db, "select count(*)::int as n from jobs where tenant_id = $1", tenantId),
    countWhere(db, "select count(*)::int as n from workflow_tasks where tenant_id = $1 and status = 'open'", tenantId),
  ]);
  return { users, forms, submissions, jobs, openTasks };
}
