import { incidentForm, supplierForm } from "../forms/templates.ts";
import { validateForm } from "../forms/engine.ts";
import { generateFormFromText } from "../forms/generate.ts";
import { toCapabilities, toJsonSchema, toToolDefinition } from "../forms/schema-export.ts";
import { mcpTools } from "./mcp.ts";
import { advanceServices } from "../forms/workflow-run.ts";
import type { FormDefinition, Submission } from "../forms/types.ts";
import { mutateSnapshot, readSnapshot, writeSnapshot, type WorkspaceSnapshot } from "./snapshot.ts";
import { bootPlatform, persistSnapshot, sameWorkspace } from "./durable-server.ts";
import { workspaceHash } from "./durable.ts";
import { getSql } from "../db.ts";
import { WORKSPACE_TENANT } from "../domain/workspace-store.ts";
import { completeWorkflowTask, publishForm, submitForm } from "../domain/commands.ts";
import { authorize, type Action } from "../authz/authorize.ts";
import { guard } from "../authz/http-gate.ts";
import { ownsPreviewSnapshot } from "../authz/tenant-scope.ts";
import { runTenantCommand } from "../domain/tx.ts";
import type { WorkspaceRole } from "./rbac.ts";
import { applySecurityHeaders } from "../security/http.ts";

function json(body: unknown, status = 200) {
  return applySecurityHeaders(Response.json(body, { status }));
}

async function commit(snap: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
  try {
    await persistSnapshot(snap);
  } catch (error) {
    console.error("[agent] snapshot not persisted:", error instanceof Error ? error.message : error);
  }
  return snap;
}

async function ensureSeed() {
  if (readSnapshot().forms.length > 0) return;
  const seeded = writeSnapshot({ revision: 1, forms: [supplierForm(), incidentForm()], submissions: [], idempotency: [] });
  await commit(seeded);
}

async function findForm(nameOrId: string, tenantId: string): Promise<FormDefinition | undefined> {
  if (ownsPreviewSnapshot(tenantId)) {
    return readSnapshot().forms.find((form) => form.name === nameOrId || form.id === nameOrId);
  }
  const rows = await runTenantCommand(tenantId, (sql) =>
    sql.query<{ id: string; name: string; title: string; description: string; display: "form" | "wizard"; status: FormDefinition["status"]; version: number; schema: FormDefinition["components"] | string; workflow: FormDefinition["workflow"] | string | null; settings: FormDefinition["settings"] | string; tags: string[] | string; created_at: string; updated_at: string; pdf_pages: number }>(
      "select id, name, title, description, display, status, version, schema, workflow, settings, tags, created_at, updated_at, pdf_pages from forms where tenant_id = $1 and (id = $2 or name = $2)",
      [tenantId, nameOrId],
    ),
  );
  const row = rows[0];
  if (!row) return undefined;
  const parse = <T>(value: T | string | null): T | undefined => {
    if (value == null) return undefined;
    return typeof value === "string" ? (JSON.parse(value) as T) : value;
  };
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    description: row.description ?? "",
    display: row.display,
    status: row.status,
    version: Number(row.version),
    hasUnpublishedChanges: false,
    components: parse(row.schema) ?? [],
    settings: parse(row.settings) ?? { submitLabel: "Submit", draftLabel: "Save", successMessage: "Received.", allowDraft: true },
    workflow: parse(row.workflow),
    tags: parse(row.tags) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: [],
    activity: [],
    pdfPages: Number(row.pdf_pages ?? 1),
  };
}

function agentAction(method: string, parts: string[]): Action | "public" {
  if (method === "GET" && parts[0] === "health") return "public";
  if (parts[0] === "sync") return method === "GET" ? "form.read" : "form.update";
  if (method === "GET" && parts[0] === "forms") return "form.read";
  if (method === "POST" && parts[0] === "forms" && parts[1] === "generate") return "form.create";
  if (method === "POST" && parts[2] === "validate-object") return "form.read";
  if (method === "POST" && parts[2] === "submit-object") return "submission.create";
  if (parts[0] === "submissions" && method === "GET") return "submission.read";
  if (parts[0] === "submissions" && method === "PATCH") return "submission.update";
  if (method === "POST" && parts[2] === "publish") return "form.publish";
  if (method === "POST" && parts[0] === "workflows") return "workflow.task.complete";
  if (parts[0] === "jobs" && method === "GET") return "workflow.read";
  if (parts[0] === "jobs") return "workflow.manage";
  if (parts[0] === "mcp") return "agent.execute";
  return "form.read";
}

export async function handleAgent(method: string, path: string, request: Request): Promise<Response> {
  try {
    await bootPlatform();
  } catch (error) {
    console.error("[agent] persistence unavailable:", error instanceof Error ? error.message : error);
  }
  const parts = path.split("/").filter(Boolean);
  const action = agentAction(method, parts);
  let tenantId = WORKSPACE_TENANT;
  let role: WorkspaceRole = "owner";
  if (action !== "public") {
    const gated = await guard(request, action, { type: parts[0] ?? "api", id: parts[1] });
    if (!gated.ok) return gated.response;
    tenantId = gated.actor.tenantId;
    role = gated.actor.role;
    await ensureSeed();
  }
  const allow = (next: Action, type: string, id?: string) =>
    authorize({ actor: { tenantId, userId: "api", role }, action: next, resource: { tenantId, type, id } });
  if (method === "GET" && parts[0] === "health" && parts[1] === "live") return json({ ok: true, status: "live" });
  if (method === "GET" && parts[0] === "health" && parts[1] === "ready") return json({ ok: true, status: "ready", persistence: "postgresql" });
  if (method === "POST" && parts[0] === "sync") {
    if (!ownsPreviewSnapshot(tenantId)) return json({ error: { code: "FORBIDDEN", message: "This snapshot belongs to another tenant" } }, 403);
    const body = (await request.json()) as WorkspaceSnapshot;
    const current = readSnapshot();
    const incoming: WorkspaceSnapshot = {
      revision: body.revision ?? 0,
      forms: body.forms ?? [],
      submissions: body.submissions ?? [],
      idempotency: body.idempotency ?? [],
    };
    if (sameWorkspace(current, incoming)) return json(current);
    if ((body.revision ?? 0) < current.revision && current.forms.length > 0) return json(current);
    const saved = writeSnapshot({ ...incoming, revision: Math.max(current.revision, body.revision ?? 0) + 1 });
    await commit(saved);
    return json({ ...saved, contentHash: workspaceHash(saved) });
  }
  if (method === "GET" && parts[0] === "sync") {
    if (!ownsPreviewSnapshot(tenantId)) return json({ error: { code: "FORBIDDEN", message: "This snapshot belongs to another tenant" } }, 403);
    return json(readSnapshot());
  }
  if (method === "GET" && parts.length === 1 && parts[0] === "forms") {
    if (!ownsPreviewSnapshot(tenantId)) {
      const rows = await runTenantCommand(tenantId, (sql) => sql.query("select id, name, title, status, version from forms where tenant_id = $1", [tenantId]));
      return json({ forms: rows });
    }
    return json({ forms: readSnapshot().forms.map((form) => ({ id: form.id, name: form.name, title: form.title, status: form.status, version: form.version })) });
  }
  if (method === "GET" && parts[0] === "forms" && parts.length === 2) {
    const form = await findForm(parts[1] ?? "", tenantId);
    return form ? json(form) : json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
  }
  if (method === "GET" && parts[0] === "forms" && parts.length === 3) {
    const form = await findForm(parts[1] ?? "", tenantId);
    if (!form) return json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    if (parts[2] === "capabilities") return json(toCapabilities(form));
    if (parts[2] === "input-schema" || parts[2] === "json-schema") return json(toJsonSchema(form));
    if (parts[2] === "tool-definition" || parts[2] === "agent-schema") return json(toToolDefinition(form));
    if (parts[2] === "openapi") return json(openApi(form));
  }
  if (method === "GET" && parts[0] === "mcp" && parts[1] === "tools") {
    return json(mcpTools(readSnapshot().forms));
  }
  if (method === "POST" && parts[0] === "forms" && parts[1] === "generate") {
    const body = (await request.json()) as { prompt?: string };
    if (!body.prompt || body.prompt.trim().length < 8) return json({ error: { code: "BAD_REQUEST", message: "Describe the form" } }, 400);
    return json({ form: generateFormFromText(body.prompt), provider: "local" });
  }
  if (method === "POST" && parts[0] === "forms" && parts[2] === "validate-object") {
    const form = await findForm(parts[1] ?? "", tenantId);
    if (!form) return json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    const body = (await request.json()) as { data?: Record<string, unknown> };
    const errors = validateForm(form, body.data ?? {});
    return json({ ok: Object.keys(errors).length === 0, errors });
  }
  if (method === "POST" && parts[0] === "forms" && parts[2] === "submit-object") {
    const form = await findForm(parts[1] ?? "", tenantId);
    if (!form) return json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    const body = (await request.json()) as { data?: Record<string, unknown> };
    const key = request.headers.get("idempotency-key") ?? undefined;
    const data = body.data ?? {};
    const hash = JSON.stringify(data);
    const snap = readSnapshot();
    if (key) {
      const prior = snap.idempotency.find((item) => item.key === key);
      if (prior && prior.hash !== hash) return json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used with a different payload" } }, 409);
      if (prior) {
        const existing = snap.submissions.find((item) => item.id === prior.submissionId);
        if (existing) return json({ submissionId: existing.id, status: existing.status, workflow: existing.workflow });
      }
    }
    const result = await runTenantCommand(tenantId, (sql) => submitForm(sql, tenantId, form, { data, actor: role, idempotencyKey: key }));
    if (!result.ok || !result.submission) {
      const status = result.code === "IDEMPOTENCY_CONFLICT" ? 409 : 422;
      return json({ error: { code: result.code ?? "FORM_VALIDATION_FAILED", message: result.message ?? "Submission was rejected", details: result.errors } }, status);
    }
    if (result.replay) return json({ submissionId: result.submission.id, status: result.submission.status, replay: true });
    let submission = result.submission;
    submission = await advanceServices(form, submission, "Meridian");
    const now = submission.updatedAt;
    mutateSnapshot((current) => ({
      ...current,
      revision: current.revision + 1,
      submissions: [submission, ...current.submissions],
      idempotency: key ? [...current.idempotency.filter((item) => item.key !== key), { key, hash, submissionId: submission.id, at: now }] : current.idempotency,
    }));
    await commit(readSnapshot());
    return json({ submissionId: submission.id, status: submission.status, workflow: submission.workflow, documents: submission.documents });
  }
  if (method === "GET" && parts[0] === "submissions" && parts[1]) {
    if (!ownsPreviewSnapshot(tenantId)) {
      const rows = await runTenantCommand(tenantId, (sql) => sql.query("select id, status, data, workflow from submissions where id = $1 and tenant_id = $2", [parts[1], tenantId]));
      return rows[0] ? json(rows[0]) : json({ error: { code: "NOT_FOUND", message: "Submission not found" } }, 404);
    }
    const found = readSnapshot().submissions.find((item) => item.id === parts[1]);
    return found ? json(found) : json({ error: { code: "NOT_FOUND", message: "Submission not found" } }, 404);
  }
  if (method === "PATCH" && parts[0] === "submissions" && parts[1]) {
    if (!ownsPreviewSnapshot(tenantId)) return json({ error: { code: "NOT_FOUND", message: "Submission not found" } }, 404);
    const body = (await request.json()) as { data?: Record<string, unknown> };
    let updated: Submission | undefined;
    mutateSnapshot((current) => ({
      ...current,
      revision: current.revision + 1,
      submissions: current.submissions.map((item) => {
        if (item.id !== parts[1]) return item;
        updated = { ...item, data: body.data ?? item.data, updatedAt: new Date().toISOString() };
        return updated;
      }),
    }));
    await commit(readSnapshot());
    return updated ? json(updated) : json({ error: { code: "NOT_FOUND", message: "Submission not found" } }, 404);
  }
  if (method === "POST" && parts[0] === "forms" && parts[2] === "publish") {
    const form = await findForm(parts[1] ?? "", tenantId);
    if (!form) return json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    const decision = allow("form.publish", "form", form.id);
    if (!decision.allow) return json({ error: { code: "FORBIDDEN", message: decision.reason } }, 403);
    const result = await runTenantCommand(tenantId, (sql) => publishForm(sql, tenantId, form, role, "Published from the agent API"));
    return json(result, result.ok ? 200 : 422);
  }
  if (method === "POST" && parts[0] === "workflows" && parts[1] === "tasks" && parts[3] === "complete") {
    const decision = allow("workflow.task.complete", "task", parts[2]);
    if (!decision.allow) return json({ error: { code: "FORBIDDEN", message: decision.reason } }, 403);
    const body = (await request.json()) as { decision?: "approve" | "reject" | "changes"; comment?: string };
    if (!body.decision) return json({ error: { code: "BAD_REQUEST", message: "decision is required" } }, 400);
    const result = await runTenantCommand(tenantId, (sql) => completeWorkflowTask(sql, tenantId, { taskId: parts[2] ?? "", actor: role, decision: body.decision ?? "approve", comment: body.comment }));
    return json(result, result.ok ? 200 : result.code === "NOT_FOUND" ? 404 : 409);
  }
  if (parts[0] === "jobs") {
    const decision = allow("workflow.read", "job", parts[1]);
    if (!decision.allow) return json({ error: { code: "FORBIDDEN", message: decision.reason } }, 403);
    const sql = await getSql();
    if (method === "GET" && !parts[1]) {
      const jobs = await sql.query("select id, queue, status, attempts, run_at from jobs where tenant_id = $1 order by created_at desc limit 50", [tenantId]);
      return json({ jobs });
    }
    if (method === "GET" && parts[1] && !parts[2]) {
      const rows = await sql.query("select id, queue, status, attempts, last_error, payload from jobs where tenant_id = $1 and id = $2", [tenantId, parts[1]]);
      return rows[0] ? json(rows[0]) : json({ error: { code: "NOT_FOUND", message: "Job not found" } }, 404);
    }
    if (method === "POST" && parts[2] === "retry") {
      const rows = await sql.query(
        "update jobs set status = 'queued', run_at = now(), updated_at = now() where tenant_id = $1 and id = $2 and status = 'dead' returning id",
        [tenantId, parts[1]],
      );
      return rows[0] ? json({ ok: true }) : json({ error: { code: "NOT_FOUND", message: "No dead job with that id" } }, 404);
    }
    if (method === "POST" && parts[2] === "cancel") {
      const rows = await sql.query(
        "update jobs set status = 'cancelled', updated_at = now() where tenant_id = $1 and id = $2 and status in ('queued', 'retry') returning id",
        [tenantId, parts[1]],
      );
      return rows[0] ? json({ ok: true }) : json({ error: { code: "NOT_FOUND", message: "Job is not cancellable" } }, 404);
    }
  }
  return json({ error: { code: "NOT_FOUND", message: `No agent route for ${method} /${path}` } }, 404);
}

function openApi(form: FormDefinition) {
  const schema = toJsonSchema(form);
  return {
    openapi: "3.1.0",
    info: { title: form.title, version: String(form.version) },
    paths: {
      [`/api/agent/v1/forms/${form.name}/submit-object`]: {
        post: {
          operationId: `submit_${form.name}`,
          parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { data: schema }, required: ["data"] } } } },
          responses: { "200": { description: "Accepted" }, "422": { description: "Validation failed" } },
        },
      },
    },
  };
}
