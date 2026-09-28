import { accessDecision, type PublicationPolicy } from "../access/publication.ts";
import { admitFill, noteConsumption } from "../access/fill-gate.ts";
import { publishIfApproved, saveStudioDraft, type StudioHead } from "../collab/studio-gate.ts";
import { cancelBusJob, emptyBus, enqueue, pump, retryBusJob, type BusState } from "../jobs/closure-bus.ts";
import { generatePlacedDocument } from "../pdf/place-pdf.ts";
import { getDocumentBytes, listDocumentHistory, rememberDocument, regenerateDocument, samplePdf } from "../pdf/document-registry.ts";
import { acceptancePorts, pauseForRestart, resumeAfterRestart } from "../workflow/restart.ts";
import { mergePrefill, signPrefill, verifyPrefill, type PrefillClaims } from "../access/prefill.ts";
import { decide, type AbacPolicy, type AbacSubject } from "../access/abac.ts";
import { addComment, saveEdit, transitionReview, type ReviewState } from "../collab/review.ts";
import { evaluateFlag, type FlagContext, type FlagRule } from "../flags/evaluate.ts";
import { resolveLookup, type LookupConfig, type LookupDeps } from "../datasources/cascade.ts";
import { buildAuthorizeUrl, createAuthTransaction, createPkce, parseDiscovery } from "../identity/oidc.ts";
import { enqueueNotice, renderNotice, type NoticeName } from "../notify/provider.ts";
import { planExportJob, type SubmissionFilter } from "../search/export-job.ts";
import { platformOpenApi } from "../developer/openapi.ts";
import { connectorMatrix } from "../storage/capability.ts";
import { applySecurityHeaders } from "../security/http.ts";

export interface PlatformRequest {
  method: string;
  path: string;
  body?: unknown;
  now?: string;
  secret?: string;
}

function json(body: unknown, status = 200): Response {
  return applySecurityHeaders(Response.json(body, { status }));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

const bus: BusState = emptyBus();
const exportRows: Array<Record<string, unknown> & { id: string; created_at: string }> = [
  { id: "sub_1", created_at: "2026-09-01T00:00:00.000Z", form_id: "supplier", status: "submitted", vendor: "Northwind" },
];

export async function handlePlatform(request: PlatformRequest, deps?: Partial<LookupDeps>): Promise<Response> {
  const parts = request.path.split("/").filter(Boolean);
  const body = record(request.body);
  const now = request.now ?? new Date().toISOString();

  if (request.method === "POST" && parts[0] === "publication" && parts[1] === "check") {
    const policy = body.policy as PublicationPolicy | undefined;
    if (!policy?.mode) return json({ error: { code: "BAD_REQUEST", message: "policy.mode is required" } }, 400);
    return json(accessDecision(policy, now));
  }

  if (request.method === "POST" && parts[0] === "prefill" && parts[1] === "sign") {
    const claims = body.claims as PrefillClaims | undefined;
    if (!claims || !request.secret) return json({ error: { code: "BAD_REQUEST", message: "claims and secret are required" } }, 400);
    return json({ token: signPrefill(claims, request.secret) });
  }

  if (request.method === "POST" && parts[0] === "prefill" && parts[1] === "merge") {
    const token = String(body.token ?? "");
    const verified = verifyPrefill(token, request.secret ?? "", Date.parse(now));
    if (!verified.ok) return json({ error: { code: verified.code, message: "Prefill token was rejected" } }, 401);
    const query = record(body.query) as Record<string, string>;
    return json(mergePrefill(verified.claims.fields, query, verified.claims.protectedFields));
  }

  if (request.method === "POST" && parts[0] === "abac") {
    const policies = Array.isArray(body.policies) ? body.policies as AbacPolicy[] : [];
    const subject = body.subject as AbacSubject | undefined;
    if (!subject) return json({ error: { code: "BAD_REQUEST", message: "subject is required" } }, 400);
    return json(decide(String(body.action ?? ""), policies, subject));
  }

  if (request.method === "POST" && parts[0] === "comments") {
    const comment = addComment({
      targetType: body.targetType as "form" | "submission" | "task",
      targetId: String(body.targetId ?? ""),
      authorId: String(body.authorId ?? ""),
      body: String(body.body ?? ""),
    });
    if ("ok" in comment) return json({ error: { code: comment.code, message: "Comment was rejected" } }, 422);
    return json(comment, 201);
  }

  if (request.method === "POST" && parts[0] === "revisions") {
    const result = saveEdit({ baseRevision: Number(body.baseRevision), currentRevision: Number(body.currentRevision), next: body.next });
    return json(result, result.ok ? 200 : 409);
  }

  if (request.method === "POST" && parts[0] === "reviews") {
    const result = transitionReview(String(body.from) as ReviewState, String(body.to) as ReviewState);
    return json(result, result.ok ? 200 : 422);
  }

  if (request.method === "POST" && parts[0] === "flags" && parts[1] === "evaluate") {
    const rules = Array.isArray(body.rules) ? body.rules as FlagRule[] : [];
    const ctx = body.context as FlagContext | undefined;
    if (!ctx?.tenantId) return json({ error: { code: "BAD_REQUEST", message: "context.tenantId is required" } }, 400);
    return json({ enabled: evaluateFlag(rules, String(body.name ?? ""), ctx) });
  }

  if (request.method === "POST" && parts[0] === "lookups") {
    if (!deps?.fetch || !deps.now || !deps.cache || !deps.secrets) {
      return json({ error: { code: "NOT_CONFIGURED", message: "Lookup dependencies are not configured" } }, 500);
    }
    try {
      const items = await resolveLookup(body.config as LookupConfig, body.parent == null ? undefined : String(body.parent), deps as LookupDeps);
      return json({ items });
    } catch (error) {
      return json({ error: { code: "LOOKUP", message: error instanceof Error ? error.message : "Lookup failed" } }, 422);
    }
  }

  if (request.method === "POST" && parts[0] === "oidc" && parts[1] === "authorize") {
    try {
      const discovery = parseDiscovery(body.discovery);
      const pkce = createPkce();
      const tx = createAuthTransaction();
      const url = buildAuthorizeUrl({
        discovery,
        clientId: String(body.clientId ?? ""),
        redirectUri: String(body.redirectUri ?? ""),
        scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : ["openid", "profile", "email"],
        state: tx.state,
        nonce: tx.nonce,
        challenge: pkce.challenge,
      });
      return json({ url, state: tx.state, nonce: tx.nonce, verifier: pkce.verifier });
    } catch (error) {
      return json({ error: { code: "DISCOVERY", message: error instanceof Error ? error.message : "Discovery failed" } }, 422);
    }
  }

  if (request.method === "POST" && parts[0] === "notifications") {
    const name = String(body.template ?? "task_assignment") as NoticeName;
    const vars = record(body.vars) as Record<string, string>;
    return json({ rendered: renderNotice(name, vars), status: "queued" }, 202);
  }

  if (request.method === "POST" && parts[0] === "exports") {
    const filter = body.filter as SubmissionFilter | undefined;
    if (!filter?.tenantId) return json({ error: { code: "BAD_REQUEST", message: "filter.tenantId is required" } }, 400);
    return json(planExportJob(filter, Boolean(body.includeAttachments)), 202);
  }

  if (request.method === "GET" && parts[0] === "connectors") {
    return json({ connectors: connectorMatrix() });
  }

  if (request.method === "GET" && parts[0] === "openapi") {
    return json(platformOpenApi());
  }

  if (request.method === "POST" && parts[0] === "fill" && parts[1] === "admit") {
    const policy = body.policy as PublicationPolicy | undefined;
    if (!policy?.mode) return json({ error: { code: "BAD_REQUEST", message: "policy.mode is required" } }, 400);
    const admitted = admitFill({
      policy,
      nowIso: now,
      nowMs: Date.parse(now),
      secret: request.secret,
      prefillToken: body.prefillToken ? String(body.prefillToken) : undefined,
      query: record(body.query) as Record<string, string>,
      body: record(body.data),
      policies: Array.isArray(body.policies) ? body.policies as never : [],
      subject: (body.subject as never) ?? { submission: {}, actor: {}, workspace: {} },
      action: String(body.action ?? "submission.create"),
      expectedTenantId: body.tenantId ? String(body.tenantId) : undefined,
      expectedFormId: body.formId ? String(body.formId) : undefined,
    });
    if (!admitted.ok) return json(admitted, admitted.code === "ABAC" ? 403 : 422);
    return json({ ...admitted, policy: noteConsumption(policy, policy.presentedToken ?? null) });
  }

  if (request.method === "POST" && parts[0] === "studio" && parts[1] === "save") {
    const head = body.head as StudioHead | undefined;
    if (!head) return json({ error: { code: "BAD_REQUEST", message: "head is required" } }, 400);
    const saved = saveStudioDraft(head, {
      holderId: String(body.holderId ?? ""),
      baseRevision: Number(body.baseRevision),
      next: body.next,
      now: Date.parse(now),
      ttlMs: Number(body.ttlMs ?? 60_000),
    });
    return json(saved, saved.ok ? 200 : saved.code === "STALE" ? 409 : 423);
  }

  if (request.method === "POST" && parts[0] === "studio" && parts[1] === "publish") {
    const head = body.head as StudioHead | undefined;
    if (!head) return json({ error: { code: "BAD_REQUEST", message: "head is required" } }, 400);
    const result = publishIfApproved(head);
    return json(result, result.ok ? 200 : 422);
  }

  if (request.method === "POST" && parts[0] === "jobs") {
    if (parts[1] === "enqueue") {
      const type = body.type === "notification" || body.type === "pdf" ? body.type : "export";
      const job = enqueue(bus, { tenantId: String(body.tenantId ?? "ten_northwind"), type, maxAttempts: Number(body.maxAttempts ?? 3), payload: record(body.payload) });
      return json(job, 202);
    }
    if (parts[1] === "pump") {
      const result = pump(bus, { rows: exportRows });
      return json({ ...result, jobs: bus.jobs });
    }
    if (parts[1] === "cancel") return json({ ok: cancelBusJob(bus, String(body.id ?? "")) });
    if (parts[1] === "retry") return json({ ok: retryBusJob(bus, String(body.id ?? "")) });
  }

  if (request.method === "POST" && parts[0] === "documents") {
    const tenantId = String(body.tenantId ?? "");
    const submissionId = String(body.submissionId ?? "");
    if (!tenantId || !submissionId) return json({ error: { code: "BAD_REQUEST", message: "tenantId and submissionId are required" } }, 400);
    if (parts[1] === "regenerate") {
      const next = regenerateDocument(tenantId, String(body.documentId ?? ""), samplePdf(String(body.text ?? "regenerated")), String(body.actor ?? "system"), now);
      if ("ok" in next) return json(next, 404);
      return json({ documents: listDocumentHistory(tenantId, submissionId) }, 201);
    }
    const placements = Array.isArray(body.placements) ? body.placements : null;
    const pdfBytes = placements
      ? (await generatePlacedDocument({
          tenantId,
          submissionId,
          formVersionId: Number(body.formVersionId ?? 1),
          templateVersion: Number(body.templateVersion ?? 1),
          createdBy: String(body.actor ?? "system"),
          data: record(body.data),
          placements: placements as never,
          pageCount: Number(body.pageCount ?? 1),
        })).bytes
      : samplePdf(String(body.text ?? submissionId));
    const stored = rememberDocument({
      tenantId,
      submissionId,
      formVersionId: Number(body.formVersionId ?? 1),
      pdfBytes,
      createdBy: String(body.actor ?? "system"),
      now,
    });
    return json({ document: listDocumentHistory(tenantId, submissionId).at(-1), download: Boolean(getDocumentBytes(tenantId, stored.documentId)) }, 201);
  }

  if (request.method === "GET" && parts[0] === "documents") {
    const tenantId = String(body.tenantId ?? "");
    return json({ documents: tenantId ? listDocumentHistory(tenantId, String(body.submissionId ?? "")) : [] });
  }

  if (request.method === "POST" && parts[0] === "workflow" && parts[1] === "acceptance") {
    const ports = acceptancePorts(0);
    const data = record(body.data);
    const paused = await pauseForRestart(data, ports);
    const proof = await resumeAfterRestart(paused.raw, data, ports);
    return json({ paused: paused.state.status, proof, calls: ports.calls });
  }

  return json({ error: { code: "NOT_FOUND", message: "Unknown platform route" } }, 404);
}

export { enqueueNotice };
