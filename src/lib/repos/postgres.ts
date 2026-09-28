import type { Queryable } from "../platform/durable.ts";

export interface FormRecord {
  id: string;
  name: string;
  title: string;
  description: string;
  display: string;
  status: string;
  version: number;
  schema: unknown;
  workflow: unknown;
  tags: unknown;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
}

export interface ProfileRecord {
  id: string;
  name: string;
  kind: string;
  config: unknown;
  secret_name: string | null;
}

async function ensureTenant(db: Queryable, tenantId: string): Promise<string> {
  await db.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, tenantId]);
  const workspaceId = `ws_${tenantId}`;
  await db.query(
    "insert into workspaces (id, tenant_id, name) values ($1, $2, $3) on conflict (id) do nothing",
    [workspaceId, tenantId, tenantId],
  );
  return workspaceId;
}

function parseJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/**
 * Tenant-scoped repositories. The tenant id is fixed at construction and is never taken from row input.
 */
export function repositories(db: Queryable, tenantId: string) {
  if (!tenantId || tenantId.includes("'")) throw new Error("Tenant id is required");
  return {
    tenantId,
    async ensure() {
      return ensureTenant(db, tenantId);
    },
    forms: {
      async upsert(input: { id: string; name: string; title: string; description?: string; display?: string; status?: string; version?: number; schema: unknown; workflow?: unknown; settings?: unknown; tags?: string[] }): Promise<void> {
        const workspaceId = await ensureTenant(db, tenantId);
        const now = new Date().toISOString();
        await db.query(
          `insert into forms (
             id, tenant_id, workspace_id, name, title, description, display, status, version,
             has_unpublished_changes, schema, workflow, settings, tags, activity, pdf_pages, created_at, updated_at
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,'[]'::jsonb,1,$14,$14
           )
           on conflict (id) do update set
             name = excluded.name,
             title = excluded.title,
             description = excluded.description,
             display = excluded.display,
             status = excluded.status,
             version = excluded.version,
             schema = excluded.schema,
             workflow = excluded.workflow,
             settings = excluded.settings,
             tags = excluded.tags,
             updated_at = excluded.updated_at
           where forms.tenant_id = $2`,
          [
            input.id,
            tenantId,
            workspaceId,
            input.name,
            input.title,
            input.description ?? "",
            input.display ?? "form",
            input.status ?? "draft",
            input.version ?? 1,
            JSON.stringify(input.schema),
            input.workflow == null ? null : JSON.stringify(input.workflow),
            JSON.stringify(input.settings ?? {}),
            JSON.stringify(input.tags ?? []),
            now,
          ],
        );
        await db.query("delete from form_tags where tenant_id = $1 and form_id = $2", [tenantId, input.id]);
        for (const tag of input.tags ?? []) {
          await db.query("insert into form_tags (tenant_id, form_id, tag) values ($1,$2,$3) on conflict do nothing", [tenantId, input.id, tag]);
        }
      },
      async get(id: string): Promise<FormRecord | null> {
        const rows = await db.query<FormRecord>(
          "select id, name, title, description, display, status, version, schema, workflow, tags from forms where tenant_id = $1 and id = $2",
          [tenantId, id],
        );
        const row = rows[0];
        if (!row) return null;
        return { ...row, schema: parseJson(row.schema), workflow: parseJson(row.workflow), tags: parseJson(row.tags) };
      },
      async list(): Promise<{ id: string; name: string; title: string; status: string }[]> {
        return db.query(
          "select id, name, title, status from forms where tenant_id = $1 order by title",
          [tenantId],
        );
      },
    },
    users: {
      async list(): Promise<UserRecord[]> {
        return db.query<UserRecord>(
          "select id, email, name, role, disabled from users where tenant_id = $1 order by email",
          [tenantId],
        );
      },
    },
    storage: {
      async save(input: { id: string; name: string; kind: string; config: unknown; secretName?: string }): Promise<void> {
        await ensureTenant(db, tenantId);
        await db.query(
          `insert into storage_profiles (id, tenant_id, name, kind, config, secret_name)
           values ($1,$2,$3,$4,$5::jsonb,$6)
           on conflict (id) do update set name = excluded.name, kind = excluded.kind, config = excluded.config, secret_name = excluded.secret_name
           where storage_profiles.tenant_id = $2`,
          [input.id, tenantId, input.name, input.kind, JSON.stringify(input.config), input.secretName ?? null],
        );
      },
      async get(id: string): Promise<ProfileRecord | null> {
        const rows = await db.query<ProfileRecord>(
          "select id, name, kind, config, secret_name from storage_profiles where tenant_id = $1 and id = $2",
          [tenantId, id],
        );
        const row = rows[0];
        return row ? { ...row, config: parseJson(row.config) } : null;
      },
    },
    ecm: {
      async save(input: { id: string; name: string; kind: string; config: unknown; secretName?: string }): Promise<void> {
        await ensureTenant(db, tenantId);
        await db.query(
          `insert into ecm_profiles (id, tenant_id, name, kind, config, secret_name)
           values ($1,$2,$3,$4,$5::jsonb,$6)
           on conflict (id) do update set name = excluded.name, kind = excluded.kind, config = excluded.config, secret_name = excluded.secret_name
           where ecm_profiles.tenant_id = $2`,
          [input.id, tenantId, input.name, input.kind, JSON.stringify(input.config), input.secretName ?? null],
        );
      },
      async get(id: string): Promise<ProfileRecord | null> {
        const rows = await db.query<ProfileRecord>(
          "select id, name, kind, config, secret_name from ecm_profiles where tenant_id = $1 and id = $2",
          [tenantId, id],
        );
        const row = rows[0];
        return row ? { ...row, config: parseJson(row.config) } : null;
      },
    },
    flags: {
      async set(name: string, enabled: boolean): Promise<void> {
        await ensureTenant(db, tenantId);
        await db.query(
          `insert into feature_flags (tenant_id, name, enabled) values ($1,$2,$3)
           on conflict (tenant_id, name) do update set enabled = excluded.enabled`,
          [tenantId, name, enabled],
        );
      },
      async get(name: string): Promise<boolean> {
        const rows = await db.query<{ enabled: boolean }>("select enabled from feature_flags where tenant_id = $1 and name = $2", [tenantId, name]);
        return rows[0]?.enabled === true;
      },
    },
    jobs: {
      async list(): Promise<{ id: string; queue: string; status: string }[]> {
        return db.query("select id, queue, status from jobs where tenant_id = $1 order by created_at desc limit 100", [tenantId]);
      },
    },
    audit: {
      async list(limit = 50): Promise<{ seq: number; actor: string; action: string; target: string; detail: string | null }[]> {
        return db.query(
          "select seq, actor, action, target, detail from audit_events where tenant_id = $1 order by seq desc limit $2",
          [tenantId, Math.min(limit, 200)],
        );
      },
    },
  };
}
