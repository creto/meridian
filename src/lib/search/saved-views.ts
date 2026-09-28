import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { buildSubmissionQuery, type SubmissionFilter } from "./export-job.ts";

export interface SavedViewRow {
  id: string;
  name: string;
  resource: string;
  filter: SubmissionFilter;
}

export function validateView(name: string, filter: SubmissionFilter): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("Name is required");
  if (!filter.tenantId) errors.push("Tenant is required");
  if ((filter.limit ?? 50) > 500) errors.push("Limit cannot exceed 500");
  return errors;
}

export async function saveView(db: Queryable, ownerId: string, name: string, filter: SubmissionFilter): Promise<SavedViewRow> {
  const errors = validateView(name, filter);
  if (errors.length) throw new Error(errors.join("; "));
  const id = `view_${randomBytes(6).toString("hex")}`;
  await db.query(
    `insert into saved_views (id, tenant_id, owner_id, name, resource, filter)
     values ($1,$2,$3,$4,'submissions',$5::jsonb)`,
    [id, filter.tenantId, ownerId, name.trim(), JSON.stringify(filter)],
  );
  return { id, name: name.trim(), resource: "submissions", filter };
}

export async function listViews(db: Queryable, tenantId: string, ownerId: string): Promise<SavedViewRow[]> {
  const rows = await db.query<{ id: string; name: string; resource: string; filter: SubmissionFilter }>(
    "select id, name, resource, filter from saved_views where tenant_id = $1 and owner_id = $2 order by name",
    [tenantId, ownerId],
  );
  return rows.map((row) => ({ id: row.id, name: row.name, resource: row.resource, filter: row.filter }));
}

export function queryForView(view: SavedViewRow): { text: string; params: unknown[] } {
  return buildSubmissionQuery(view.filter);
}
