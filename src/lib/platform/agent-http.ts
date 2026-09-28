import { incidentForm, supplierForm } from "../forms/templates.ts";
import { validateForm } from "../forms/engine.ts";
import { generateFormFromText } from "../forms/generate.ts";
import { uid } from "../forms/ids.ts";
import { toCapabilities, toJsonSchema, toToolDefinition } from "../forms/schema-export.ts";
import { mcpTools } from "./mcp.ts";
import { advanceServices, startWorkflow } from "../forms/workflow-run.ts";
import type { FormDefinition, Submission } from "../forms/types.ts";
import { mutateSnapshot, readSnapshot, writeSnapshot, type WorkspaceSnapshot } from "./snapshot.ts";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function ensureSeed() {
  if (readSnapshot().forms.length > 0) return;
  writeSnapshot({ revision: 1, forms: [supplierForm(), incidentForm()], submissions: [], idempotency: [] });
}

function findForm(nameOrId: string): FormDefinition | undefined {
  const snap = readSnapshot();
  return snap.forms.find((form) => form.name === nameOrId || form.id === nameOrId);
}

export async function handleAgent(method: string, path: string, request: Request): Promise<Response> {
  ensureSeed();
  const parts = path.split("/").filter(Boolean);
  if (method === "POST" && parts[0] === "sync") {
    const body = (await request.json()) as WorkspaceSnapshot;
    const saved = writeSnapshot({
      revision: body.revision ?? 0,
      forms: body.forms ?? [],
      submissions: body.submissions ?? [],
      idempotency: body.idempotency ?? [],
    });
    return json({ revision: saved.revision });
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
    const now = new Date().toISOString();
    let submission: Submission = {
      id: uid("sub"),
      formId: form.id,
      formName: form.name,
      formVersion: form.version,
      createdAt: now,
      updatedAt: now,
      status: form.workflow ? "in_review" : "submitted",
      data,
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
    return updated ? json(updated) : json({ error: { code: "NOT_FOUND", message: "Submission not found" } }, 404);
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
