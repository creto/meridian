import { incidentForm, supplierForm } from "../forms/templates.ts";
import { validateForm } from "../forms/engine.ts";
import { settleCaptcha } from "../forms/captcha.ts";
import { generateFormFromText } from "../forms/generate.ts";
import { uid } from "../forms/ids.ts";
import { toCapabilities, toJsonSchema, toToolDefinition } from "../forms/schema-export.ts";
import { mcpTools } from "./mcp.ts";
import { advanceServices, startWorkflow } from "../forms/workflow-run.ts";
import type { FormDefinition, Submission } from "../forms/types.ts";
import { mutateSnapshot, readSnapshot, writeSnapshot, type WorkspaceSnapshot } from "./snapshot.ts";
import { bootPlatform, persistSnapshot, sameWorkspace } from "./durable-server.ts";
import { workspaceHash } from "./durable.ts";
import { getSql, withTransaction } from "../db.ts";
import { WORKSPACE_TENANT } from "../domain/workspace-store.ts";
import { completeWorkflowTask, publishForm } from "../domain/commands.ts";
import { authorize } from "../authz/authorize.ts";
import { authenticatePresentedKey } from "./api-keys.ts";
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

async function resumeTimers(): Promise<void> {
  const snap = readSnapshot();
  let changed = false;
  const submissions = [];
  for (const submission of snap.submissions) {
    if (submission.workflow?.waitUntil && Date.parse(submission.workflow.waitUntil) <= Date.now()) {
      const form = snap.forms.find((item) => item.id === submission.formId);
      if (form) {
        submissions.push(await advanceServices(form, submission, "timer"));
        changed = true;
        continue;
      }
    }
    submissions.push(submission);
  }
  if (!changed) return;
  await commit(writeSnapshot({ ...snap, revision: snap.revision + 1, submissions }));
}

async function ensureSeed() {
  if (readSnapshot().forms.length > 0) return;
  const seeded = writeSnapshot({ revision: 1, forms: [supplierForm(), incidentForm()], submissions: [], idempotency: [] });
  await commit(seeded);
}

function findForm(nameOrId: string): FormDefinition | undefined {
  const snap = readSnapshot();
  return snap.forms.find((form) => form.name === nameOrId || form.id === nameOrId);
}

export async function handleAgent(method: string, path: string, request: Request): Promise<Response> {
  try {
    await bootPlatform();
  } catch (error) {
    console.error("[agent] persistence unavailable:", error instanceof Error ? error.message : error);
  }
  await resumeTimers();
  await ensureSeed();
  const parts = path.split("/").filter(Boolean);
  let tenantId = WORKSPACE_TENANT;
  let role: WorkspaceRole = "owner";
  const bearer = request.headers.get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    try {
      const sql = await getSql();
      const auth = await authenticatePresentedKey(sql, bearer.slice(7).trim());
      if (!auth) return json({ error: { code: "UNAUTHORIZED", message: "API key was rejected" } }, 401);
      tenantId = auth.tenantId;
      const known: WorkspaceRole[] = ["owner", "designer", "clerk", "reviewer", "agent", "viewer"];
      role = known.includes(auth.role as WorkspaceRole) ? (auth.role as WorkspaceRole) : "agent";
    } catch (error) {
      return json({ error: { code: "UNAUTHORIZED", message: error instanceof Error ? error.message : "API key check failed" } }, 401);
    }
  }
  const allow = (action: Parameters<typeof authorize>[0]["action"], type: string, id?: string) =>
    authorize({ actor: { tenantId, userId: "api", role }, action, resource: { tenantId, type, id } });
  if (method === "GET" && parts[0] === "health" && parts[1] === "live") return json({ ok: true, status: "live" });
  if (method === "GET" && parts[0] === "health" && parts[1] === "ready") return json({ ok: true, status: "ready", persistence: "postgresql" });
  if (method === "POST" && parts[0] === "sync") {
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
  if (method === "GET" && parts[0] === "sync") return json(readSnapshot());
  if (method === "GET" && parts.length === 1 && parts[0] === "forms") {
    return json({ forms: readSnapshot().forms.map((form) => ({ id: form.id, name: form.name, title: form.title, status: form.status, version: form.version })) });
  }
  if (method === "GET" && parts[0] === "forms" && parts.length === 2) {
    const form = findForm(parts[1] ?? "");
    return form ? json(form) : json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
  }
  if (method === "GET" && parts[0] === "forms" && parts.length === 3) {
    const form = findForm(parts[1] ?? "");
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
    const form = findForm(parts[1] ?? "");
    if (!form) return json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    const body = (await request.json()) as { data?: Record<string, unknown> };
    const errors = validateForm(form, body.data ?? {});
    return json({ ok: Object.keys(errors).length === 0, errors });
  }
  if (method === "POST" && parts[0] === "forms" && parts[2] === "submit-object") {
    const form = findForm(parts[1] ?? "");
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
    const errors = validateForm(form, data);
    if (Object.keys(errors).length) return json({ error: { code: "FORM_VALIDATION_FAILED", message: "Submission contains invalid fields", details: errors } }, 422);
    const settled = settleCaptcha(form.components, data);
    if (!settled.ok) return json({ error: { code: "FORM_VALIDATION_FAILED", message: "Submission contains invalid fields", details: settled.errors } }, 422);
    const stored = settled.data;
    const now = new Date().toISOString();
    let submission: Submission = {
      id: uid("sub"),
      formId: form.id,
      formName: form.name,
      formVersion: form.version,
      createdAt: now,
      updatedAt: now,
      status: form.workflow ? "in_review" : "submitted",
      data: stored,
      revisions: [],
      documents: [],
      workflow: startWorkflow(form, "agent"),
      idempotencyKey: key,
    };
    submission = await advanceServices(form, submission, "Meridian");
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
    const found = readSnapshot().submissions.find((item) => item.id === parts[1]);
    return found ? json(found) : json({ error: { code: "NOT_FOUND", message: "Submission not found" } }, 404);
  }
  if (method === "PATCH" && parts[0] === "submissions" && parts[1]) {
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
    const form = findForm(parts[1] ?? "");
    if (!form) return json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    const decision = allow("form.publish", "form", form.id);
    if (!decision.allow) return json({ error: { code: "FORBIDDEN", message: decision.reason } }, 403);
    const result = await withTransaction((sql) => publishForm(sql, tenantId, form, role, "Published from the agent API"));
    return json(result, result.ok ? 200 : 422);
  }
  if (method === "POST" && parts[0] === "workflows" && parts[1] === "tasks" && parts[3] === "complete") {
    const decision = allow("workflow.task.complete", "task", parts[2]);
    if (!decision.allow) return json({ error: { code: "FORBIDDEN", message: decision.reason } }, 403);
    const body = (await request.json()) as { decision?: "approve" | "reject" | "changes"; comment?: string };
    if (!body.decision) return json({ error: { code: "BAD_REQUEST", message: "decision is required" } }, 400);
    const result = await withTransaction((sql) => completeWorkflowTask(sql, tenantId, { taskId: parts[2] ?? "", actor: role, decision: body.decision ?? "approve", comment: body.comment }));
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
