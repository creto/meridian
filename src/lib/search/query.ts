import type { Queryable } from "../platform/durable.ts";

export interface FormHit {
  id: string;
  name: string;
  title: string;
  status: string;
  version: number;
}

export interface SubmissionHit {
  id: string;
  formId: string;
  formName: string;
  status: string;
  createdAt: string;
}

function like(value: string): string {
  return `%${value.replace(/[%_\\]/g, "")}%`;
}

/** Tenant-scoped. A blank tenant matches nothing. */
export async function searchForms(
  db: Queryable,
  tenantId: string,
  filter: { title?: string; status?: string; tag?: string; limit?: number },
): Promise<FormHit[]> {
  if (!tenantId) return [];
  const clauses = ["f.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  if (filter.title) {
    params.push(like(filter.title));
    clauses.push(`(f.title ilike $${params.length} or f.name ilike $${params.length})`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`f.status = $${params.length}`);
  }
  if (filter.tag) {
    params.push(filter.tag);
    clauses.push(`exists (select 1 from form_tags t where t.tenant_id = f.tenant_id and t.form_id = f.id and t.tag = $${params.length})`);
  }
  params.push(Math.min(filter.limit ?? 50, 200));
  return db.query<FormHit>(
    `select f.id, f.name, f.title, f.status, f.version from forms f where ${clauses.join(" and ")} order by f.updated_at desc limit $${params.length}`,
    params,
  );
}

export async function searchSubmissions(
  db: Queryable,
  tenantId: string,
  filter: { formId?: string; status?: string; from?: string; to?: string; limit?: number },
): Promise<SubmissionHit[]> {
  if (!tenantId) return [];
  const clauses = ["tenant_id = $1"];
  const params: unknown[] = [tenantId];
  if (filter.formId) {
    params.push(filter.formId);
    clauses.push(`form_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filter.from) {
    params.push(filter.from);
    clauses.push(`created_at >= $${params.length}`);
  }
  if (filter.to) {
    params.push(filter.to);
    clauses.push(`created_at <= $${params.length}`);
  }
  params.push(Math.min(filter.limit ?? 50, 200));
  const rows = await db.query<{ id: string; form_id: string; form_name: string; status: string; created_at: string | Date }>(
    `select id, form_id, form_name, status, created_at from submissions where ${clauses.join(" and ")} order by created_at desc limit $${params.length}`,
    params,
  );
  return rows.map((row) => ({
    id: row.id,
    formId: row.form_id,
    formName: row.form_name,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}
