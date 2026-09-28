import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { appendAudit } from "../platform/durable.ts";

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export interface RevisionResult {
  ok: boolean;
  code?: "NOT_FOUND" | "CONFLICT" | "ARCHIVED";
  message?: string;
  seq?: number;
}

export async function reviseSubmission(
  db: Queryable,
  tenantId: string,
  input: { submissionId: string; expectedUpdatedAt: string; data: Record<string, unknown>; actor: string; note?: string },
): Promise<RevisionResult> {
  const rows = await db.query<{ updated_at: string | Date; status: string }>(
    "select updated_at, status from submissions where id = $1 and tenant_id = $2 for update",
    [input.submissionId, tenantId],
  );
  const current = rows[0];
  if (!current) return { ok: false, code: "NOT_FOUND", message: "Submission not found" };
  if (current.status === "deleted") return { ok: false, code: "ARCHIVED", message: "Submission can no longer be revised" };
  const stamp = current.updated_at instanceof Date ? current.updated_at.toISOString() : new Date(current.updated_at).toISOString();
  if (stamp !== new Date(input.expectedUpdatedAt).toISOString()) {
    return { ok: false, code: "CONFLICT", message: "Submission was updated by someone else" };
  }
  const seqRows = await db.query<{ seq: number }>(
    "select coalesce(max(seq), 0)::int as seq from submission_revisions where tenant_id = $1 and submission_id = $2",
    [tenantId, input.submissionId],
  );
  const seq = Number(seqRows[0]?.seq ?? 0) + 1;
  const now = new Date().toISOString();
  await db.query(
    "update submissions set data = $3::jsonb, updated_at = $4 where id = $1 and tenant_id = $2",
    [input.submissionId, tenantId, JSON.stringify(input.data), now],
  );
  await db.query(
    "insert into submission_revisions (tenant_id, submission_id, seq, at, actor, note, data) values ($1,$2,$3,$4,$5,$6,$7::jsonb)",
    [tenantId, input.submissionId, seq, now, input.actor, input.note ?? "Revised", JSON.stringify(input.data)],
  );
  await appendAudit(db, tenantId, { actor: input.actor, action: "submission.update", target: input.submissionId, detail: `seq ${seq}` });
  await db.query(
    "insert into outbox_events (id, tenant_id, topic, payload) values ($1,$2,'submission.revised',$3::jsonb)",
    [nid("out"), tenantId, JSON.stringify({ submissionId: input.submissionId, seq })],
  );
  return { ok: true, seq };
}

export async function archiveForm(db: Queryable, tenantId: string, formId: string, actor: string): Promise<RevisionResult> {
  const rows = await db.query(
    "update forms set status = 'archived', updated_at = now() where id = $1 and tenant_id = $2 and status <> 'archived' returning id",
    [formId, tenantId],
  );
  if (!rows.length) return { ok: false, code: "NOT_FOUND", message: "Form not found" };
  await appendAudit(db, tenantId, { actor, action: "form.archive", target: formId });
  await db.query(
    "insert into outbox_events (id, tenant_id, topic, payload) values ($1,$2,'form.archived',$3::jsonb)",
    [nid("out"), tenantId, JSON.stringify({ formId })],
  );
  return { ok: true };
}

export async function listSubmissionRevisions(db: Queryable, tenantId: string, submissionId: string): Promise<{ seq: number; actor: string; note: string; at: string | Date }[]> {
  return db.query(
    "select seq, actor, note, at from submission_revisions where tenant_id = $1 and submission_id = $2 order by seq",
    [tenantId, submissionId],
  );
}
