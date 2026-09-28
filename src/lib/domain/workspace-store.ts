import type { Queryable, WorkspacePayload } from "../platform/durable.ts";
import type { FormDefinition, FormVersion, IdempotencyRecord, Submission } from "../forms/types.ts";

/** Server-chosen tenant for the unsigned preview workspace. Never taken from the client. */
export const WORKSPACE_TENANT = "ten_northwind";

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function asObject<T>(value: T | string | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}

function asArray<T>(value: T[] | string | null | undefined): T[] {
  const parsed = asObject<T[]>(value as T[] | string | null | undefined);
  return Array.isArray(parsed) ? parsed : [];
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function workspaceId(tenantId: string): string {
  return `ws_${tenantId}`;
}

interface FormRow {
  id: string;
  name: string;
  title: string;
  description: string;
  display: "form" | "wizard";
  status: "draft" | "published" | "archived";
  version: number;
  has_unpublished_changes: boolean;
  schema: FormDefinition["components"] | string;
  workflow: FormDefinition["workflow"] | string | null;
  settings: FormDefinition["settings"] | string;
  storage: FormDefinition["storage"] | string | null;
  targets: FormDefinition["targets"] | string | null;
  tags: string[] | string;
  activity: FormDefinition["activity"] | string;
  pdf_pages: number;
  source: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  published_at: string | Date | null;
}

interface VersionRow {
  form_id: string;
  version: number;
  saved_at: string | Date;
  note: string;
  title: string;
  display: "form" | "wizard";
  schema: FormVersion["components"] | string;
  workflow: FormVersion["workflow"] | string | null;
}

interface SubmissionRow {
  id: string;
  form_id: string;
  form_name: string;
  form_version: number;
  status: Submission["status"];
  data: Submission["data"] | string;
  workflow: Submission["workflow"] | string | null;
  documents: Submission["documents"] | string;
  idempotency_key: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface RevisionRow {
  submission_id: string;
  seq: number;
  at: string | Date;
  actor: string;
  note: string;
  data: Record<string, unknown> | string;
}

/**
 * Replace one tenant's forms, versions, submissions, and workflow rows.
 * The caller owns the transaction. Other tenants are not touched.
 */
export async function replaceTenantWorkspace(db: Queryable, tenantId: string, payload: WorkspacePayload): Promise<void> {
  const ws = workspaceId(tenantId);
  await db.query(
    `insert into workspaces (id, tenant_id, name) values ($1, $2, $3)
     on conflict (id) do nothing`,
    [ws, tenantId, tenantId === WORKSPACE_TENANT ? "Northwind" : tenantId],
  );

  const formIds = (payload.forms as FormDefinition[]).map((form) => form.id);
  const submissionIds = (payload.submissions as Submission[]).map((item) => item.id);
  if (formIds.length === 0) {
    await db.query("delete from submissions where tenant_id = $1", [tenantId]);
    await db.query("delete from forms where tenant_id = $1", [tenantId]);
  } else {
    if (submissionIds.length === 0) {
      await db.query("delete from submissions where tenant_id = $1", [tenantId]);
    } else {
      await db.query("delete from submissions where tenant_id = $1 and not (id = any($2::text[]))", [tenantId, submissionIds]);
    }
    await db.query("delete from forms where tenant_id = $1 and not (id = any($2::text[]))", [tenantId, formIds]);
  }

  for (const raw of payload.forms as FormDefinition[]) {
    await db.query(
      `insert into forms (
         id, tenant_id, workspace_id, name, title, description, display, status, version,
         has_unpublished_changes, schema, workflow, settings, storage, targets, tags, activity,
         pdf_pages, source, created_at, updated_at, published_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22
       )
       on conflict (id) do update set
         tenant_id = excluded.tenant_id,
         workspace_id = excluded.workspace_id,
         name = excluded.name,
         title = excluded.title,
         description = excluded.description,
         display = excluded.display,
         status = excluded.status,
         version = excluded.version,
         has_unpublished_changes = excluded.has_unpublished_changes,
         schema = excluded.schema,
         workflow = excluded.workflow,
         settings = excluded.settings,
         storage = excluded.storage,
         targets = excluded.targets,
         tags = excluded.tags,
         activity = excluded.activity,
         pdf_pages = excluded.pdf_pages,
         source = excluded.source,
         updated_at = excluded.updated_at,
         published_at = excluded.published_at`,
      [
        raw.id,
        tenantId,
        ws,
        raw.name,
        raw.title,
        raw.description ?? "",
        raw.display,
        raw.status,
        raw.version,
        raw.hasUnpublishedChanges,
        json(raw.components),
        raw.workflow ? json(raw.workflow) : null,
        json(raw.settings),
        raw.storage ? json(raw.storage) : null,
        raw.targets ? json(raw.targets) : null,
        json(raw.tags ?? []),
        json(raw.activity ?? []),
        raw.pdfPages ?? 1,
        raw.source ?? null,
        raw.createdAt,
        raw.updatedAt,
        raw.publishedAt ?? null,
      ],
    );
    for (const version of raw.versions ?? []) {
      await db.query(
        `insert into form_versions (tenant_id, form_id, version, saved_at, note, title, display, schema, workflow)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
         on conflict (tenant_id, form_id, version) do nothing`,
        [
          tenantId,
          raw.id,
          version.version,
          version.savedAt,
          version.note,
          version.title,
          version.display,
          json(version.components),
          version.workflow ? json(version.workflow) : null,
        ],
      );
    }
  }

  for (const raw of payload.submissions as Submission[]) {
    await db.query(
      `insert into submissions (
         id, tenant_id, workspace_id, form_id, form_name, form_version, status, data, workflow, documents, idempotency_key, created_at, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13)
       on conflict (id) do update set
         form_id = excluded.form_id,
         form_name = excluded.form_name,
         form_version = excluded.form_version,
         status = excluded.status,
         data = excluded.data,
         workflow = excluded.workflow,
         documents = excluded.documents,
         idempotency_key = excluded.idempotency_key,
         updated_at = excluded.updated_at`,
      [
        raw.id,
        tenantId,
        ws,
        raw.formId,
        raw.formName,
        raw.formVersion,
        raw.status,
        json(raw.data),
        raw.workflow ? json(raw.workflow) : null,
        json(raw.documents ?? []),
        raw.idempotencyKey ?? null,
        raw.createdAt,
        raw.updatedAt,
      ],
    );
    await db.query("delete from submission_revisions where tenant_id = $1 and submission_id = $2", [tenantId, raw.id]);
    for (const [seq, revision] of (raw.revisions ?? []).entries()) {
      await db.query(
        `insert into submission_revisions (tenant_id, submission_id, seq, at, actor, note, data)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [tenantId, raw.id, seq + 1, revision.at, revision.actor, revision.note, json(revision.data)],
      );
    }
    if (raw.workflow) {
      await db.query(
        `insert into workflow_instances (submission_id, tenant_id, status, current_node, state, updated_at)
         values ($1,$2,$3,$4,$5::jsonb,$6)
         on conflict (submission_id) do update set
           status = excluded.status,
           current_node = excluded.current_node,
           state = excluded.state,
           updated_at = excluded.updated_at`,
        [raw.id, tenantId, raw.status, raw.workflow.currentNode, json(raw.workflow), raw.updatedAt],
      );
    } else {
      await db.query("delete from workflow_instances where tenant_id = $1 and submission_id = $2", [tenantId, raw.id]);
    }
  }

  for (const record of (payload.idempotency ?? []) as IdempotencyRecord[]) {
    await db.query(
      `insert into idempotency_records (tenant_id, key, request_hash, response)
       values ($1,$2,$3,$4::jsonb)
       on conflict (tenant_id, key) do update set request_hash = excluded.request_hash, response = excluded.response`,
      [tenantId, record.key, record.hash, json({ submissionId: record.submissionId, at: record.at })],
    );
  }

  await db.query(
    `insert into outbox_events (id, tenant_id, topic, payload)
     values ($1,$2,'workspace.projected',$3::jsonb)
     on conflict (id) do nothing`,
    [`out_${tenantId}_${payload.revision}`, tenantId, json({ revision: payload.revision, forms: formIds.length, submissions: payload.submissions.length })],
  );
}

/** Read one tenant. Returns null when that tenant has no relational forms yet. */
export async function loadTenantWorkspace(db: Queryable, tenantId: string): Promise<WorkspacePayload | null> {
  const count = await db.query<{ n: number }>("select count(*)::int as n from forms where tenant_id = $1", [tenantId]);
  if (!count[0] || Number(count[0].n) === 0) return null;

  const forms = await db.query<FormRow>("select * from forms where tenant_id = $1 order by updated_at desc", [tenantId]);
  const versions = await db.query<VersionRow>(
    "select * from form_versions where tenant_id = $1 order by form_id, version",
    [tenantId],
  );
  const submissions = await db.query<SubmissionRow>("select * from submissions where tenant_id = $1 order by created_at", [tenantId]);
  const revisions = await db.query<RevisionRow>(
    "select * from submission_revisions where tenant_id = $1 order by submission_id, seq",
    [tenantId],
  );
  const idem = await db.query<{ key: string; request_hash: string; response: { submissionId?: string; at?: string } | string }>(
    "select key, request_hash, response from idempotency_records where tenant_id = $1",
    [tenantId],
  );
  const revisionRow = await db.query<{ revision: number }>("select revision from workspace_state where tenant_id = $1", [tenantId]);

  const versionsByForm = new Map<string, FormVersion[]>();
  for (const row of versions) {
    const list = versionsByForm.get(row.form_id) ?? [];
    list.push({
      version: Number(row.version),
      savedAt: iso(row.saved_at),
      note: row.note,
      title: row.title,
      display: row.display,
      components: asArray(row.schema),
      workflow: asObject(row.workflow) ?? undefined,
    });
    versionsByForm.set(row.form_id, list);
  }

  const revisionsBySubmission = new Map<string, Submission["revisions"]>();
  for (const row of revisions) {
    const list = revisionsBySubmission.get(row.submission_id) ?? [];
    list.push({
      at: iso(row.at),
      actor: row.actor,
      note: row.note,
      data: asObject(row.data) ?? {},
    });
    revisionsBySubmission.set(row.submission_id, list);
  }

  return {
    revision: Number(revisionRow[0]?.revision ?? 1),
    forms: forms.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      description: row.description,
      display: row.display,
      status: row.status,
      version: Number(row.version),
      hasUnpublishedChanges: Boolean(row.has_unpublished_changes),
      components: asArray(row.schema),
      settings: asObject(row.settings) ?? { submitLabel: "Submit", draftLabel: "Save draft", successMessage: "Received.", allowDraft: true },
      workflow: asObject(row.workflow) ?? undefined,
      storage: asObject(row.storage) ?? undefined,
      targets: asObject(row.targets) ?? undefined,
      tags: asArray<string>(row.tags),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      publishedAt: row.published_at ? iso(row.published_at) : undefined,
      versions: versionsByForm.get(row.id) ?? [],
      activity: asArray(row.activity),
      pdfPages: Number(row.pdf_pages ?? 1),
      source: row.source ?? undefined,
    })),
    submissions: submissions.map((row) => ({
      id: row.id,
      formId: row.form_id,
      formName: row.form_name,
      formVersion: Number(row.form_version),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      status: row.status,
      data: asObject(row.data) ?? {},
      revisions: revisionsBySubmission.get(row.id) ?? [],
      workflow: asObject(row.workflow) ?? undefined,
      documents: asArray(row.documents),
      idempotencyKey: row.idempotency_key ?? undefined,
    })),
    idempotency: idem.map((row) => {
      const response = asObject(row.response) ?? {};
      return {
        key: row.key,
        hash: row.request_hash,
        submissionId: response.submissionId ?? "",
        at: response.at ?? "",
      };
    }),
  };
}
