import assert from "node:assert/strict";
import test from "node:test";
import { applyManualMap, startAcroSession, unmappedFields } from "../pdf/acro-session.ts";
import { planDocument, regenerateDocument, listDocuments } from "../pdf/generated-docs.ts";
import { accessDecision } from "../access/publication.ts";
import { mergePrefill, signPrefill, verifyPrefill } from "../access/prefill.ts";
import { assertAllowed, decide } from "../access/abac.ts";
import { acquireLock, addComment, releaseLock, saveEdit, transitionReview } from "../collab/review.ts";
import { evaluateFlag, rolloutBucket } from "../flags/evaluate.ts";
import { LookupClient, flushClock, createDebouncedValidator, resolveLookup } from "../datasources/cascade.ts";
import { buildAuthorizeUrl, createPkce, mapClaims, parseDiscovery, redactOidc, tokenRequestBody } from "../identity/oidc.ts";
import { Tracer, childTraceParent, parseTraceParent } from "../observe/otel.ts";
import { assertNoRawSecret, createMemoryProvider, renderNotice } from "../notify/provider.ts";
import { buildSubmissionQuery, decodeCursor, encodeCursor, importReport, planExportJob, rowsToXlsx } from "../search/export-job.ts";
import { assertTrustedPlugin, scaffoldComponent, validateComponentName } from "../plugins/scaffold.ts";
import { buildRestEcmRequest, nextRetryDelay, normalizeEcmError, readPath } from "../storage/rest-ecm.ts";
import { fitGraph, hitNode, layoutWorkflow } from "../workflow/layout.ts";
import type { WorkflowDef } from "../forms/types.ts";
import type { Queryable } from "../platform/durable.ts";

test("acroform suggestions prefer exact keys and warn on duplicates", () => {
  const session = startAcroSession(
    [
      { name: "legalName", type: "text", page: 0, x: 0.1, y: 0.1, w: 0.3, h: 0.04 },
      { name: "agree", type: "checkbox", page: 0, x: 0.1, y: 0.3, w: 0.03, h: 0.03 },
      { name: "mystery", type: "text", page: 0, x: 0.1, y: 0.4, w: 0.2, h: 0.04 },
    ],
    [
      { key: "legalName", label: "Legal name", type: "textfield" },
      { key: "agree", label: "I agree", type: "checkbox" },
    ],
  );
  assert.equal(session.mapping.legalName, "legalName");
  assert.equal(session.mapping.agree, "agree");
  assert.equal(unmappedFields(session).map((field) => field.name).join(","), "mystery");
  const duplicated = applyManualMap(session, "mystery", "legalName");
  assert.ok(duplicated.warnings.some((warning) => warning.includes("both")));
});

test("regeneration inserts a new document id", async () => {
  const stored: unknown[][] = [];
  const db: Queryable = {
    async query<T>(_text: string, params: unknown[] = []): Promise<T[]> {
      stored.push(params);
      if (_text.startsWith("select")) {
        const mapped = stored.filter((row) => row[1] === params[0] && row[2] === params[1]).map((row) => ({
          id: row[0], tenant_id: row[1], submission_id: row[2], form_version: row[3], template_version: row[4],
          source_template_hash: row[5], generated_pdf_hash: row[6], generated_at: row[7], status: row[8],
          storage_provider: row[9], external_reference: row[10], created_by: row[11], source_hash: row[13], generated_hash: row[14],
        }));
        return mapped as T[];
      }
      return [] as T[];
    },
  };
  const first = planDocument({ tenantId: "ten", submissionId: "sub", formVersionId: 2, pdfBytes: new Uint8Array([1, 2]), createdBy: "ada", now: "2026-01-01T00:00:00.000Z" });
  const second = await regenerateDocument(db, first, new Uint8Array([9]), "bea");
  assert.notEqual(first.documentId, second.documentId);
  assert.notEqual(first.generatedHash, second.generatedHash);
  const listed = await listDocuments(db, "ten", "sub");
  assert.equal(listed.length, 1);
});

test("publication modes, prefill protection, and abac", () => {
  const now = "2026-06-01T00:00:00.000Z";
  assert.equal(accessDecision({ mode: "PUBLIC_LINK", submissionsSoFar: 0, oneSubmissionPerToken: true, usedTokens: ["tok"], linkToken: "tok", presentedToken: "tok", allowedEmbedDomains: [], allowedOrigins: [], hasSession: false, viaApi: false }, now).code, "TOKEN_REPLAY");
  assert.equal(accessDecision({ mode: "EMBEDDED", submissionsSoFar: 0, oneSubmissionPerToken: false, usedTokens: [], allowedEmbedDomains: ["forms.example"], allowedOrigins: [], embedder: "https://forms.example/page", hasSession: false, viaApi: false }, now).code, "OK");
  assert.equal(accessDecision({ mode: "API_ONLY", submissionsSoFar: 0, oneSubmissionPerToken: false, usedTokens: [], allowedEmbedDomains: [], allowedOrigins: [], hasSession: true, viaApi: false }, now).code, "MODE");
  const token = signPrefill({ tenantId: "ten", formId: "frm", exp: 5_000, fields: { department: "legal", note: "a" }, protectedFields: ["department"] }, "secret");
  const verified = verifyPrefill(token, "secret", 1_000);
  assert.equal(verified.ok, true);
  assert.equal(verifyPrefill(token, "secret", 9_000).ok, false);
  const merged = mergePrefill({ department: "legal", note: "a" }, { department: "evil", note: "b" }, ["department"]);
  assert.equal(merged.data.department, "legal");
  assert.equal(merged.data.note, "b");
  assert.deepEqual(merged.rejectedKeys, ["department"]);
  const decision = decide("submission.read", [{ id: "p1", action: "submission.read", expression: "submission.department == actor.department", enabled: true }], {
    submission: { department: "legal" },
    actor: { department: "finance" },
    workspace: {},
  });
  assert.equal(decision.allow, false);
  assert.throws(() => assertAllowed("submission.read", [{ id: "p1", action: "submission.read", expression: "submission.department == actor.department", enabled: true }], {
    submission: { department: "legal" },
    actor: { department: "finance" },
    workspace: {},
  }));
});

test("locks, reviews, flags, and cascading lookups", async () => {
  assert.equal(saveEdit({ baseRevision: 1, currentRevision: 2, next: {} }).ok, false);
  assert.equal(saveEdit({ baseRevision: 2, currentRevision: 2, next: { a: 1 } }).ok, true);
  const first = acquireLock(null, "ada", 3, 0, 100);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(acquireLock(first.lock, "bea", 3, 50, 100).ok, false);
  assert.equal(acquireLock(first.lock, "bea", 3, 200, 100).ok, true);
  assert.equal(releaseLock(first.lock, "ada"), null);
  assert.equal(transitionReview("draft", "approved").ok, false);
  assert.equal(transitionReview("draft", "in_review").ok, true);
  const empty = addComment({ targetType: "task", targetId: "t", authorId: "ada", body: "  " });
  assert.equal("ok" in empty && empty.ok, false);
  const bucket = rolloutBucket("beta", "user_1");
  assert.equal(bucket, rolloutBucket("beta", "user_1"));
  assert.equal(evaluateFlag([{ name: "beta", scope: "global", scopeId: "*", enabled: true, rollout: 100 }, { name: "beta", scope: "user", scopeId: "user_1", enabled: false, rollout: 100 }], "beta", { tenantId: "t", userId: "user_1" }), false);
  const items = await resolveLookup({ kind: "catalog", dependsOn: "country", catalog: { MX: [{ label: "CDMX", value: "cdmx" }] } }, "MX", { fetch: async () => ({ ok: true, status: 200, body: [] }), now: () => 0, cache: new Map(), secrets: {} });
  assert.equal(items[0]?.value, "cdmx");
  await assert.rejects(() => resolveLookup({ kind: "rest", url: "http://169.254.169.254/latest" }, undefined, { fetch: async () => ({ ok: true, status: 200, body: [] }), now: () => 0, cache: new Map(), secrets: {} }));
  const client = new LookupClient();
  let releaseSlow: (value: { generation: number; items: { label: string; value: string }[] }) => void = () => undefined;
  const slow = client.resolve("city", (generation) => new Promise((resolve) => { releaseSlow = () => resolve({ generation, items: [{ label: "old", value: "old" }] }); }));
  const fast = await client.resolve("city", async (generation) => ({ generation, items: [{ label: "new", value: "new" }] }));
  releaseSlow({ generation: 1, items: [{ label: "old", value: "old" }] });
  await slow;
  assert.equal(fast?.[0]?.value, "new");
  assert.equal(client.snapshot("city")[0]?.value, "new");
  const clock = { now: 0, waiters: [] as Array<{ at: number; fn: () => void }> };
  const pending = createDebouncedValidator(async (value) => value === "taken" ? "exists" : null, 20, clock)("taken");
  flushClock(clock, 20);
  assert.equal(await pending, "exists");
});

test("oidc, telemetry, notices, export, plugins, ecm, and layout", () => {
  const discovery = parseDiscovery({ issuer: "https://idp.example", authorization_endpoint: "https://idp.example/auth", token_endpoint: "https://idp.example/token", jwks_uri: "https://idp.example/jwks" });
  const pkce = createPkce();
  assert.equal(pkce.method, "S256");
  const url = new URL(buildAuthorizeUrl({ discovery, clientId: "meridian", redirectUri: "https://app.example/cb", scopes: ["openid"], state: "s", nonce: "n", challenge: pkce.challenge }));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(tokenRequestBody("code", pkce.verifier, "https://app.example/cb", "meridian").includes("code_verifier="));
  assert.equal(mapClaims({ sub: "u1", email: "a@b.c", roles: ["designer"] }).userId, "u1");
  assert.equal((redactOidc({ client_secret: "nope", issuer: "x" }) as { client_secret: string }).client_secret, "***");
  const tracer = new Tracer();
  const span = tracer.startSpan("http.request", { attributes: { password: "hide", path: "/forms" }, now: 10 });
  tracer.end(span, 20);
  const child = parseTraceParent(childTraceParent(span));
  assert.equal(child?.traceId, span.traceId);
  assert.equal(span.attributes.password, "***");
  tracer.counter("http_requests_total");
  const otlp = tracer.exportOtlpJson();
  assert.equal((otlp.resourceSpans[0] as { scopeSpans: { spans: unknown[] }[] }).scopeSpans[0]?.spans.length, 1);
  const notice = renderNotice("task_assignment", { title: "<b>", name: "Ada", url: "https://example.com" });
  assert.equal(notice.html.includes("<b>"), false);
  assert.throws(() => assertNoRawSecret({ apiKey: "raw-secret" }));
  const provider = createMemoryProvider();
  const query = buildSubmissionQuery({ tenantId: "ten", text: "north", cursor: encodeCursor({ id: "sub_1", at: "2026-01-01T00:00:00.000Z" }), limit: 10 });
  assert.ok(query.text.includes("ilike"));
  assert.equal(decodeCursor(encodeCursor({ id: "a", at: "b" }))?.id, "a");
  const book = rowsToXlsx([{ name: "Ada", city: "CDMX" }]);
  assert.ok(book.byteLength > 100);
  assert.equal(planExportJob({ tenantId: "ten" }, true).queue, "export");
  assert.equal(importReport([{ ok: true }, { ok: false, errors: ["email"] }]).rejected[0]?.row, 2);
  assert.throws(() => validateComponentName("../Etc"));
  assert.throws(() => assertTrustedPlugin({ id: "stranger" }, [], []));
  assertTrustedPlugin({ id: "ok", signature: "a".repeat(128), keyId: "k1" }, [], ["k1"]);
  const files = scaffoldComponent("VendorBadge");
  assert.ok(files["VendorBadge.validator.ts"]?.includes("VendorBadge is required"));
  const request = buildRestEcmRequest({
    method: "post",
    urlTemplate: "https://ecm.example/docs/{id}",
    query: { folder: "{folder}" },
    multipart: false,
    jsonBody: { name: "{name}" },
    documentIdPath: "data.id",
    retryDelaysMs: [100, 500],
    secretRefs: { authorization: "ecm" },
  }, { id: "42", folder: "legal", name: "contract" }, { ecm: "Bearer test" });
  assert.equal(request.headers.authorization, "Bearer test");
  assert.equal(readPath({ data: { id: "42" } }, "data.id"), "42");
  assert.equal(normalizeEcmError(503, "down").retryable, true);
  assert.equal(nextRetryDelay([100, 500], 2), null);
  const layout = layoutWorkflow({
    nodes: [
      { id: "s", type: "start", title: "Start" },
      { id: "a", type: "human", title: "A", role: "r" },
      { id: "b", type: "human", title: "B", role: "r" },
      { id: "e", type: "end", title: "End" },
    ],
    edges: [{ from: "s", to: "a" }, { from: "s", to: "b" }, { from: "a", to: "e" }, { from: "b", to: "e" }],
  } satisfies WorkflowDef);
  assert.equal(layout.nodes.length, 4);
  assert.equal(hitNode(layout, layout.nodes[0]!.x + 2, layout.nodes[0]!.y + 2), layout.nodes[0]!.id);
  const fitted = fitGraph(layout, { width: 200, height: 200 });
  assert.ok(fitted.scale <= 1);
  void provider;
});
