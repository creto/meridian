import type { Queryable } from "../platform/durable.ts";
import { advanceServices } from "../forms/workflow-run.ts";
import type { FormComponent, FormDefinition, Submission, WorkflowDef, WorkflowState } from "../forms/types.ts";

interface DueRow {
  id: string;
  tenant_id: string;
  form_id: string;
  form_name: string;
  form_version: number;
  status: Submission["status"];
  data: Record<string, unknown> | string;
  workflow: WorkflowState | string;
  documents: Submission["documents"] | string;
  created_at: string | Date;
  updated_at: string | Date;
  title: string;
  display: "form" | "wizard";
  schema: FormComponent[] | string;
  form_workflow: WorkflowDef | string | null;
  settings: FormDefinition["settings"] | string;
}

function json<T>(value: T | string | null): T | null {
  if (value == null) return null;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

/** Continue submissions whose timer is due. The agent request path does not do this. */
export async function advanceDueTimers(db: Queryable, now = new Date()): Promise<number> {
  const due = await db.query<DueRow>(
    `select s.id, s.tenant_id, s.form_id, s.form_name, s.form_version, s.status, s.data, s.workflow,
            s.documents, s.created_at, s.updated_at, f.title, f.display, f.schema, f.workflow as form_workflow, f.settings
     from submissions s
     join forms f on f.id = s.form_id and f.tenant_id = s.tenant_id
     where s.workflow->>'waitUntil' is not null
       and (s.workflow->>'waitUntil')::timestamptz <= $1::timestamptz
     for update of s skip locked`,
    [now.toISOString()],
  );
  let advanced = 0;
  for (const row of due) {
    const workflow = json<WorkflowState>(row.workflow);
    const definition = json<WorkflowDef>(row.form_workflow);
    if (!workflow || !definition) continue;
    const form: FormDefinition = {
      id: row.form_id,
      name: row.form_name,
      title: row.title,
      description: "",
      display: row.display,
      status: "published",
      version: Number(row.form_version),
      hasUnpublishedChanges: false,
      components: json<FormComponent[]>(row.schema) ?? [],
      settings: json<FormDefinition["settings"]>(row.settings) ?? { submitLabel: "Submit", draftLabel: "Save", successMessage: "Received.", allowDraft: true },
      workflow: definition,
      tags: [],
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      versions: [],
      activity: [],
      pdfPages: 1,
    };
    const submission: Submission = {
      id: row.id,
      formId: row.form_id,
      formName: row.form_name,
      formVersion: Number(row.form_version),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      status: row.status,
      data: json<Record<string, unknown>>(row.data) ?? {},
      revisions: [],
      workflow,
      documents: json<Submission["documents"]>(row.documents) ?? [],
    };
    const next = await advanceServices(form, submission, "worker");
    await db.query(
      `update submissions set status = $3, workflow = $4::jsonb, documents = $5::jsonb, updated_at = $6
       where id = $1 and tenant_id = $2`,
      [row.id, row.tenant_id, next.status, JSON.stringify(next.workflow ?? null), JSON.stringify(next.documents), next.updatedAt],
    );
    await db.query(
      `insert into workflow_instances (submission_id, tenant_id, status, current_node, state, updated_at)
       values ($1,$2,$3,$4,$5::jsonb,$6)
       on conflict (submission_id) do update set status = excluded.status, current_node = excluded.current_node, state = excluded.state, updated_at = excluded.updated_at`,
      [row.id, row.tenant_id, next.status, next.workflow?.currentNode ?? null, JSON.stringify(next.workflow ?? {}), next.updatedAt],
    );
    advanced += 1;
  }
  return advanced;
}
