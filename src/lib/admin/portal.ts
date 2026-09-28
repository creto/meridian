export interface AdminUser {
  id: string;
  email: string;
  name: string;
  disabled: boolean;
  roles: string[];
  workspaces: string[];
  lastLogin: string | null;
  sessions: string[];
}

export interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
  workspaceId: string | null;
}

export interface AdminConnection {
  id: string;
  kind: "storage" | "ecm";
  name: string;
  provider: string;
  enabled: boolean;
  secretName: string;
  lastError: string | null;
  healthy: boolean;
}

export interface AdminJob {
  id: string;
  tenantId: string;
  type: string;
  status: "queued" | "running" | "retrying" | "failed" | "dead" | "completed" | "cancelled";
  payloadKeys: string[];
}

export interface AuditRow {
  seq: number;
  actor: string;
  action: string;
  target: string;
  at: string;
  hash: string;
  prev: string;
}

export interface AdminSnapshot {
  tenants: Array<{ id: string; name: string }>;
  users: AdminUser[];
  roles: AdminRole[];
  connections: AdminConnection[];
  jobs: AdminJob[];
  audit: AuditRow[];
  flags: Array<{ name: string; scope: string; scopeId: string; enabled: boolean; rollout: number }>;
  webhooks: Array<{ id: string; url: string; enabled: boolean }>;
  apiClients: Array<{ id: string; name: string; role: string; revoked: boolean }>;
  integrations: Array<{ id: string; name: string; kind: string; enabled: boolean }>;
}

export function seedAdmin(tenantId = "ten_northwind"): AdminSnapshot {
  return {
    tenants: [{ id: tenantId, name: "Northwind" }, { id: "ten_contoso", name: "Contoso" }],
    users: [
      { id: "user_ada", email: "ada@northwind.example", name: "Ada Lovelace", disabled: false, roles: ["owner"], workspaces: ["ws_northwind"], lastLogin: "2026-09-01T12:00:00.000Z", sessions: ["sess_1"] },
      { id: "user_bea", email: "bea@northwind.example", name: "Bea Reviewer", disabled: false, roles: ["reviewer"], workspaces: ["ws_northwind"], lastLogin: null, sessions: [] },
    ],
    roles: [
      { id: "role_owner", name: "owner", permissions: ["form.publish", "workflow.task.complete", "admin.users"], workspaceId: null },
      { id: "role_reviewer", name: "reviewer", permissions: ["workflow.task.complete"], workspaceId: "ws_northwind" },
    ],
    connections: [
      { id: "conn_s3", kind: "storage", name: "Archive", provider: "s3", enabled: true, secretName: "secret:s3", lastError: null, healthy: true },
      { id: "conn_cmis", kind: "ecm", name: "Vault", provider: "cmis", enabled: false, secretName: "secret:cmis", lastError: null, healthy: false },
    ],
    jobs: [
      { id: "job_1", tenantId, type: "export", status: "queued", payloadKeys: ["formId"] },
      { id: "job_2", tenantId, type: "webhook", status: "dead", payloadKeys: ["url"] },
    ],
    audit: [
      { seq: 1, actor: "ada", action: "publish", target: "form_supplier", at: "2026-09-01T00:00:00.000Z", prev: "genesis", hash: "aaa" },
    ],
    flags: [{ name: "pdfEditor", scope: "tenant", scopeId: tenantId, enabled: true, rollout: 100 }],
    webhooks: [{ id: "wh_1", url: "https://example.com/hooks", enabled: true }],
    apiClients: [{ id: "key_1", name: "Agent", role: "agent", revoked: false }],
    integrations: [{ id: "ai_grok", name: "Grok", kind: "ai", enabled: true }],
  };
}

export function searchUsers(snapshot: AdminSnapshot, query: string, cursor: string | null, limit: number): { users: AdminUser[]; next: string | null } {
  const filtered = snapshot.users.filter((user) => `${user.email} ${user.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.id.localeCompare(b.id));
  const start = cursor ? filtered.findIndex((user) => user.id === cursor) + 1 : 0;
  const page = filtered.slice(Math.max(0, start), Math.max(0, start) + limit);
  const last = page[page.length - 1];
  return { users: page, next: last && start + page.length < filtered.length ? last.id : null };
}

export function createUser(snapshot: AdminSnapshot, input: { email: string; name: string }): AdminSnapshot {
  if (!input.email.includes("@")) throw new Error("Email is required");
  const user: AdminUser = { id: `user_${snapshot.users.length + 1}`, email: input.email, name: input.name, disabled: false, roles: [], workspaces: [], lastLogin: null, sessions: [] };
  return { ...snapshot, users: [...snapshot.users, user] };
}

export function setDisabled(snapshot: AdminSnapshot, userId: string, disabled: boolean): AdminSnapshot {
  return { ...snapshot, users: snapshot.users.map((user) => user.id === userId ? { ...user, disabled, sessions: disabled ? [] : user.sessions } : user) };
}

export function revokeSessions(snapshot: AdminSnapshot, userId: string): AdminSnapshot {
  return { ...snapshot, users: snapshot.users.map((user) => user.id === userId ? { ...user, sessions: [] } : user) };
}

export function assignRole(snapshot: AdminSnapshot, userId: string, role: string): AdminSnapshot {
  return { ...snapshot, users: snapshot.users.map((user) => user.id === userId && !user.roles.includes(role) ? { ...user, roles: [...user.roles, role] } : user) };
}

export function cloneRole(snapshot: AdminSnapshot, roleId: string, name: string): AdminSnapshot {
  const role = snapshot.roles.find((item) => item.id === roleId);
  if (!role) throw new Error("Role not found");
  return { ...snapshot, roles: [...snapshot.roles, { ...role, id: `role_${name}`, name, permissions: [...role.permissions] }] };
}

export function setPermissions(snapshot: AdminSnapshot, roleId: string, permissions: string[]): AdminSnapshot {
  return { ...snapshot, roles: snapshot.roles.map((role) => role.id === roleId ? { ...role, permissions } : role) };
}

export function effectivePermissions(snapshot: AdminSnapshot, userId: string): string[] {
  const user = snapshot.users.find((item) => item.id === userId);
  if (!user) return [];
  const names = new Set<string>();
  for (const roleName of user.roles) {
    const role = snapshot.roles.find((item) => item.name === roleName);
    role?.permissions.forEach((permission) => names.add(permission));
  }
  return [...names].sort();
}

export function maskConnection(connection: AdminConnection): AdminConnection & { secret: never } {
  return { ...connection, secretName: connection.secretName, secret: undefined as never };
}

export function setConnection(snapshot: AdminSnapshot, id: string, patch: Partial<AdminConnection>): AdminSnapshot {
  return { ...snapshot, connections: snapshot.connections.map((item) => item.id === id ? { ...item, ...patch, secretName: item.secretName } : item) };
}

export function filterJobs(snapshot: AdminSnapshot, filter: { status?: string; tenantId?: string; type?: string }): AdminJob[] {
  return snapshot.jobs.filter((job) => {
    if (filter.status && job.status !== filter.status) return false;
    if (filter.tenantId && job.tenantId !== filter.tenantId) return false;
    if (filter.type && job.type !== filter.type) return false;
    return true;
  });
}

export function retryJob(snapshot: AdminSnapshot, id: string): AdminSnapshot {
  return { ...snapshot, jobs: snapshot.jobs.map((job) => job.id === id && job.status === "dead" ? { ...job, status: "queued" } : job) };
}

export function cancelJob(snapshot: AdminSnapshot, id: string): AdminSnapshot {
  return { ...snapshot, jobs: snapshot.jobs.map((job) => job.id === id && (job.status === "queued" || job.status === "retrying") ? { ...job, status: "cancelled" } : job) };
}

export function verifyRows(rows: AuditRow[]): { ok: boolean; brokenAt?: number } {
  let prev = "genesis";
  for (const row of rows) {
    if (row.prev !== prev) return { ok: false, brokenAt: row.seq };
    prev = row.hash;
  }
  return { ok: true };
}

export function filterAudit(rows: AuditRow[], filter: { actor?: string; action?: string }): AuditRow[] {
  return rows.filter((row) => (!filter.actor || row.actor === filter.actor) && (!filter.action || row.action === filter.action));
}
