import { createHash, randomBytes } from "node:crypto";
import { validateForm } from "../forms/engine.ts";
import { lintBlocksPublish, lintForm } from "../forms/lint.ts";
import { startWorkflow } from "../forms/workflow-run.ts";
import type { FormDefinition, Submission } from "../forms/types.ts";
import { appendAudit, type Queryable } from "../platform/durable.ts";

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function id(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

async function ensureWorkspace(db: Queryable, tenantId: string): Promise<string> {
  const ws = `ws_${tenantId}`;
  await db.query(
    `insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing`,
    [tenantId, tenantId],
  );
  await db.query(
    `insert into workspaces (id, tenant_id, name) values ($1, $2, $3) on conflict (id) do nothing`,
    [ws, tenantId, tenantId],
  );
  return ws;
}

export interface PublishResult {
  ok: boolean;
  version?: number;
  code?: string;
  message?: string;
}

/** Immutable version, published pointer, audit, outbox. Caller holds the transaction. */
export async function publishForm(db: Queryable, tenantId: string, form: FormDefinition, actor: string, note: string): Promise<PublishResult> {
  const issues = lintForm(form);
  if (lintBlocksPublish(issues)) {
    return { ok: false, code: "LINT", message: issues.find((issue) => issue.level === "error")?.message ?? "Form cannot be published" };
  }
  const ws = await ensureWorkspace(db, tenantId);
  if (form.status === "published" && !form.hasUnpublishedChanges) return { ok: true, version: form.version };
  const useVersion = form.versions.length === 0 ? Math.max(1, form.version || 1) : form.version + 1;
  const existing = await db.query<{ schema: unknown }>(
    "select schema from form_versions where tenant_id = $1 and form_id = $2 and version = $3",
    [tenantId, form.id, useVersion],
  );
  if (existing[0]) {
    const previous = existing[0].schema;
    const previousJson = typeof previous === "string" ? previous : JSON.stringify(previous);
    if (previousJson !== JSON.stringify(form.components)) {
      return { ok: false, code: "IMMUTABLE", message: `Version ${useVersion} was already published and cannot be rewritten` };
    }
  }
  const now = new Date().toISOString();
  await db.query(
    `insert into forms (
       id, tenant_id, workspace_id, name, title, description, display, status, version,
       has_unpublished_changes, schema, workflow, settings, tags, activity, pdf_pages, created_at, updated_at, published_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,'published',$8,false,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,'[]'::jsonb,$13,$14,$14,$14
     )
     on conflict (id) do update set
       title = excluded.title,
       description = excluded.description,
       display = excluded.display,
       status = 'published',
       version = excluded.version,
       has_unpublished_changes = false,
       schema = excluded.schema,
       workflow = excluded.workflow,
       settings = excluded.settings,
       updated_at = excluded.updated_at,
       published_at = excluded.published_at`,
    [
      form.id,
      tenantId,
      ws,
      form.name,
      form.title,
      form.description ?? "",
      form.display,
      useVersion,
      JSON.stringify(form.components),
      form.workflow ? JSON.stringify(form.workflow) : null,
      JSON.stringify(form.settings),
      JSON.stringify(form.tags ?? []),
      form.pdfPages ?? 1,
      now,
    ],
  );
  await db.query(
    `insert into form_versions (tenant_id, form_id, version, saved_at, note, title, display, schema, workflow)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
     on conflict (tenant_id, form_id, version) do nothing`,
    [tenantId, form.id, useVersion, now, note || "Published", form.title, form.display, JSON.stringify(form.components), form.workflow ? JSON.stringify(form.workflow) : null],
  );
  if (form.workflow) {
    const defId = `wfd_${form.id}`;
    await db.query(
      `insert into workflow_definitions (id, tenant_id, form_id, name) values ($1,$2,$3,$4) on conflict (id) do nothing`,
      [defId, tenantId, form.id, form.name],
    );
    await db.query(
      `insert into workflow_versions (tenant_id, definition_id, version, definition) values ($1,$2,$3,$4::jsonb)
       on conflict (tenant_id, definition_id, version) do nothing`,
      [tenantId, defId, useVersion, JSON.stringify(form.workflow)],
    );
  }
  await appendAudit(db, tenantId, { actor, action: "form.publish", target: form.id, detail: `v${useVersion}` });
  await db.query(
    `insert into outbox_events (id, tenant_id, topic, payload) values ($1,$2,'form.published',$3::jsonb) on conflict (id) do nothing`,
    [`out_pub_${form.id}_${useVersion}`, tenantId, JSON.stringify({ formId: form.id, version: useVersion })],
  );
  return { ok: true, version: useVersion };
}

export interface SubmitResult {
  ok: boolean;
  submission?: Submission;
  code?: string;
  message?: string;
  errors?: Record<string, string>;
  replay?: boolean;
}

export async function submitForm(
  db: Queryable,
  tenantId: string,
  form: FormDefinition,
  input: { data: Record<string, unknown>; actor: string; idempotencyKey?: string; draft?: boolean },
): Promise<SubmitResult> {
  if (form.status === "archived") return { ok: false, code: "ARCHIVED", message: "This form is archived" };
  const hash = sha(input.data);
  if (input.idempotencyKey) {
    const prior = await db.query<{ request_hash: string; response: { submissionId?: string } | string }>(
      "select request_hash, response from idempotency_records where tenant_id = $1 and key = $2",
      [tenantId, input.idempotencyKey],
    );
    const row = prior[0];
    if (row && row.request_hash !== hash) {
      return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used with a different payload" };
    }
    if (row) {
      const response = typeof row.response === "string" ? (JSON.parse(row.response) as { submissionId?: string }) : row.response;
      const existing = await db.query<Submission>("select id, status from submissions where tenant_id = $1 and id = $2", [tenantId, response.submissionId ?? ""]);
      if (existing[0]) return { ok: true, replay: true, submission: existing[0] };
    }
  }
  if (!input.draft) {
    const errors = validateForm(form, input.data);
    if (Object.keys(errors).length) return { ok: false, code: "FORM_VALIDATION_FAILED", message: "Submission contains invalid fields", errors };
  }
  const versionRows = await db.query<{ version: number; schema: unknown; workflow: unknown }>(
    "select version, schema, workflow from form_versions where tenant_id = $1 and form_id = $2 order by version desc limit 1",
    [tenantId, form.id],
  );
  const pinned = versionRows[0];
  const formVersion = pinned ? Number(pinned.version) : form.version;
  const ws = await ensureWorkspace(db, tenantId);
  const now = new Date().toISOString();
  const submissionId = id("sub");
  const workflow = input.draft ? undefined : startWorkflow(form, input.actor);
  const status = input.draft ? "draft" : workflow ? "in_review" : "submitted";
  await db.query(
    `insert into submissions (id, tenant_id, workspace_id, form_id, form_name, form_version, status, data, workflow, documents, idempotency_key, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,'[]'::jsonb,$10,$11,$11)`,
    [submissionId, tenantId, ws, form.id, form.name, formVersion, status, JSON.stringify(input.data), workflow ? JSON.stringify(workflow) : null, input.idempotencyKey ?? null, now],
  );
  await db.query(
    `insert into submission_revisions (tenant_id, submission_id, seq, at, actor, note, data) values ($1,$2,1,$3,$4,$5,$6::jsonb)`,
    [tenantId, submissionId, now, input.actor, input.draft ? "Draft" : "Submitted", JSON.stringify(input.data)],
  );
  if (workflow) {
    await db.query(
      `insert into workflow_instances (submission_id, tenant_id, status, current_node, state, updated_at) values ($1,$2,$3,$4,$5::jsonb,$6)`,
      [submissionId, tenantId, status, workflow.currentNode, JSON.stringify(workflow), now],
    );
    const tokenId = id("tok");
    await db.query(
      `insert into workflow_tokens (id, tenant_id, submission_id, node_id, branch_id, status) values ($1,$2,$3,$4,'main','active')`,
      [tokenId, tenantId, submissionId, workflow.currentNode],
    );
    await db.query(
      `insert into workflow_tasks (id, tenant_id, submission_id, node_id, assigned_role, status) values ($1,$2,$3,$4,$5,'open')`,
      [id("task"), tenantId, submissionId, workflow.currentNode, "Reviewer"],
    );
    await db.query(
      `insert into workflow_events (id, tenant_id, submission_id, seq, node_id, event, actor) values ($1,$2,$3,1,$4,'started',$5)`,
      [id("evt"), tenantId, submissionId, workflow.currentNode, input.actor],
    );
  }
  if (input.idempotencyKey) {
    await db.query(
      `insert into idempotency_records (tenant_id, key, request_hash, response) values ($1,$2,$3,$4::jsonb)
       on conflict (tenant_id, key) do nothing`,
      [tenantId, input.idempotencyKey, hash, JSON.stringify({ submissionId, at: now })],
    );
  }
  await appendAudit(db, tenantId, { actor: input.actor, action: input.draft ? "submission.draft" : "submission.create", target: submissionId, detail: form.name });
  await db.query(
    `insert into outbox_events (id, tenant_id, topic, payload) values ($1,$2,$3,$4::jsonb)`,
    [id("out"), tenantId, input.draft ? "submission.draft" : "submission.created", JSON.stringify({ submissionId, formId: form.id })],
  );
  const submission: Submission = {
    id: submissionId,
    formId: form.id,
    formName: form.name,
    formVersion,
    createdAt: now,
    updatedAt: now,
    status,
    data: input.data,
    revisions: [{ at: now, actor: input.actor, note: input.draft ? "Draft" : "Submitted", data: input.data }],
    documents: [],
    workflow,
    idempotencyKey: input.idempotencyKey,
  };
  return { ok: true, submission };
}

export async function completeWorkflowTask(
  db: Queryable,
  tenantId: string,
  input: { taskId: string; actor: string; decision: "approve" | "reject" | "changes"; comment?: string },
): Promise<{ ok: true; eventSeq: number } | { ok: false; code: string; message: string }> {
  const locked = await db.query<{ id: string; submission_id: string; node_id: string; status: string }>(
    `select id, submission_id, node_id, status from workflow_tasks where id = $1 and tenant_id = $2 for update`,
    [input.taskId, tenantId],
  );
  const task = locked[0];
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found" };
  if (task.status === "completed") return { ok: false, code: "ALREADY_DONE", message: "Task is already complete" };
  const now = new Date().toISOString();
  await db.query(
    `update workflow_tasks set status = 'completed', decision = $3, comment = $4, completed_at = $5, claimed_by = $6
     where id = $1 and tenant_id = $2`,
    [input.taskId, tenantId, input.decision, input.comment ?? null, now, input.actor],
  );
  const seqRows = await db.query<{ seq: number }>(
    "select coalesce(max(seq), 0)::int as seq from workflow_events where tenant_id = $1 and submission_id = $2",
    [tenantId, task.submission_id],
  );
  const seq = Number(seqRows[0]?.seq ?? 0) + 1;
  await db.query(
    `insert into workflow_events (id, tenant_id, submission_id, seq, node_id, event, actor, detail) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id("evt"), tenantId, task.submission_id, seq, task.node_id, input.decision, input.actor, input.comment ?? null],
  );
  await db.query(
    `update workflow_tokens set status = 'done', completed_at = $4 where tenant_id = $1 and submission_id = $2 and node_id = $3 and status = 'active'`,
    [tenantId, task.submission_id, task.node_id, now],
  );
  await appendAudit(db, tenantId, { actor: input.actor, action: "workflow.task.complete", target: input.taskId, detail: input.decision });
  await db.query(
    `insert into outbox_events (id, tenant_id, topic, payload) values ($1,$2,'workflow.task.completed',$3::jsonb)`,
    [id("out"), tenantId, JSON.stringify({ taskId: input.taskId, decision: input.decision })],
  );
  return { ok: true, eventSeq: seq };
}
