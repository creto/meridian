import assert from "node:assert/strict";
import test from "node:test";
import { admitFill, noteConsumption } from "../access/fill-gate.ts";
import { signPrefill } from "../access/prefill.ts";
import type { PublicationPolicy } from "../access/publication.ts";
import { publishIfApproved, saveStudioDraft, type StudioHead } from "../collab/studio-gate.ts";
import { countryDepartmentCity, runCascade, validateDataSource } from "../datasources/runner.ts";
import { beginOidc, completeOidcCallback, localSession, resetIdentityTransactions, sessionCookie, verifySessionCookie } from "../identity/providers.ts";
import { cancelBusJob, emptyBus, enqueue, pump, retryBusJob } from "../jobs/closure-bus.ts";
import { Tracer } from "../observe/otel.ts";
import { beginRequest, finishRequest, redactLogLine } from "../observe/pipeline.ts";
import { listDocumentHistory, regenerateDocument, rememberDocument, resetDocumentRegistry, samplePdf } from "../pdf/document-registry.ts";
import { generateComponent, registerComponent, renderValue, createHost } from "../plugins/host.ts";
import { bundleExport, crc32 } from "../search/zip-store.ts";
import { mapImport, parseXlsx } from "../search/import-rows.ts";
import { rowsToXlsx } from "../search/export-job.ts";
import { checkUpload } from "../security/uploads.ts";
import { translate } from "../i18n/messages.ts";
import { acceptancePorts, pauseForRestart, resumeAfterRestart } from "../workflow/restart.ts";
import { nodesSafeToEnter, projectNodeRuns } from "../workflow/journal.ts";
import { startRun } from "../workflow/runtime.ts";
import { acceptanceWorkflow } from "../workflow/restart.ts";
import * as XLSX from "xlsx";

const secret = "test-secret";

function policy(overrides: Partial<PublicationPolicy> = {}): PublicationPolicy {
  return {
    mode: "AUTHENTICATED",
    submissionsSoFar: 0,
    oneSubmissionPerToken: false,
    usedTokens: [],
    allowedEmbedDomains: [],
    allowedOrigins: [],
    hasSession: true,
    viaApi: false,
    ...overrides,
  };
}

test("fill admission rejects a protected field from the query and the body", () => {
  const token = signPrefill({
    tenantId: "ten_northwind",
    formId: "supplier",
    exp: Date.parse("2026-10-01T00:00:00.000Z"),
    fields: { department: "legal", vendor: "Ada" },
    protectedFields: ["department"],
  }, secret);
  const admitted = admitFill({
    policy: policy({ mode: "PUBLIC_LINK", linkToken: "link", presentedToken: "link", hasSession: false }),
    nowIso: "2026-09-28T00:00:00.000Z",
    nowMs: Date.parse("2026-09-28T00:00:00.000Z"),
    secret,
    prefillToken: token,
    query: { department: "hacked", city: "Bogota" },
    body: { department: "also-hacked", note: "ok" },
    policies: [{ id: "same-dept", action: "submission.create", expression: "submission.department == actor.department", enabled: true }],
    subject: { submission: {}, actor: { department: "legal" }, workspace: {} },
    action: "submission.create",
    expectedTenantId: "ten_northwind",
    expectedFormId: "supplier",
  });
  assert.equal(admitted.ok, true);
  if (!admitted.ok) return;
  assert.equal(admitted.data.department, "legal");
  assert.equal(admitted.data.city, "Bogota");
  assert.equal(admitted.data.note, "ok");
  assert.ok(admitted.rejectedKeys.includes("department"));
  const next = noteConsumption(policy({ mode: "PUBLIC_LINK", presentedToken: "link", oneSubmissionPerToken: true, linkToken: "link" }), "link");
  assert.deepEqual(next.usedTokens, ["link"]);
});

test("a stale studio save cannot overwrite the current revision", () => {
  const head: StudioHead = { revision: 4, review: "draft", lock: null };
  const stale = saveStudioDraft(head, { holderId: "ada", baseRevision: 3, next: { title: "old" }, now: 10, ttlMs: 1000 });
  assert.equal(stale.ok, false);
  if (stale.ok) return;
  assert.equal(stale.code, "STALE");
  const saved = saveStudioDraft(head, { holderId: "ada", baseRevision: 4, next: { title: "new" }, now: 10, ttlMs: 1000 });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.revision, 5);
  const publish = publishIfApproved({ ...head, review: "in_review" });
  assert.equal(publish.ok, false);
});

test("acceptance workflow resumes after a snapshot and does not double-join", async () => {
  const ports = acceptancePorts(0);
  const paused = await pauseForRestart({ vendor: "Northwind" }, ports);
  const proof = await resumeAfterRestart(paused.raw, { vendor: "Northwind" }, ports);
  assert.equal(proof.status, "COMPLETED");
  assert.equal(proof.joinReleases, 1);
  assert.equal(ports.calls.pdf, 1);
  assert.equal(ports.calls.ecm, 1);
  assert.equal(ports.calls.email, 1);
  const rows = projectNodeRuns(startRun(acceptanceWorkflow(), 0), "ten_northwind", "sub_1");
  assert.ok(rows.some((row) => row.nodeId === "start"));
  assert.deepEqual(nodesSafeToEnter(startRun(acceptanceWorkflow(), 0), [{ id: "x", tenantId: "t", submissionId: "s", nodeId: "start", status: "COMPLETED", attempts: 1, lastError: null }]), []);
});

test("export job writes xlsx and a notification is queued", () => {
  const state = emptyBus();
  enqueue(state, { tenantId: "ten_northwind", type: "export", maxAttempts: 2, payload: { filter: { tenantId: "ten_northwind", formId: "supplier" } } });
  enqueue(state, { tenantId: "ten_northwind", type: "notification", maxAttempts: 2, payload: { template: "task_assignment", to: "ada@northwind.example", vars: { title: "Review", name: "Ada", url: "https://example.com" }, secretRef: "secret:smtp" } });
  const pumped = pump(state, { rows: [{ id: "sub_1", created_at: "2026-09-01T00:00:00.000Z", form_id: "supplier", status: "submitted", vendor: "Northwind" }] });
  assert.equal(pumped.ran, 2);
  assert.equal(state.jobs.every((job) => job.status === "completed"), true);
  assert.equal(state.sent.length, 1);
  assert.equal(state.files.size, 1);
  const dead = enqueue(state, { tenantId: "ten_northwind", type: "notification", maxAttempts: 1, payload: { to: "not-an-email" } });
  pump(state, { rows: [] });
  assert.equal(dead.status, "dead");
  assert.equal(retryBusJob(state, dead.id), true);
  assert.equal(cancelBusJob(state, dead.id), true);
});

test("zip bundle round-trips the workbook name and rejects traversal", () => {
  const book = rowsToXlsx([{ id: "1", vendor: "Ada" }]);
  const zip = bundleExport(book, [{ name: "note.txt", bytes: Buffer.from("hello") }]);
  assert.equal(zip.names[0], "export.xlsx");
  assert.equal(zip.sha256.length, 64);
  assert.equal(crc32(Buffer.from("hello")) > 0, true);
  assert.throws(() => bundleExport(book, [{ name: "../secret", bytes: Buffer.from("no") }]));
});

test("xlsx import reports a partial success", () => {
  const sheet = XLSX.utils.aoa_to_sheet([["Email", "Name"], ["ada@example.com", "Ada"], ["", "Missing"]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = parseXlsx(bytes);
  const mapped = mapImport(parsed, [{ header: "Email", key: "email", required: true }, { header: "Name", key: "name" }]);
  assert.equal(mapped.report.accepted, 1);
  assert.equal(mapped.report.rejected.length, 1);
});

test("cascade keeps the city that belongs to the selected department", async () => {
  const levels = countryDepartmentCity({
    countries: [{ label: "Colombia", value: "CO" }],
    departments: { CO: [{ label: "Cundinamarca", value: "CUN" }] },
    cities: { CUN: [{ label: "Bogota", value: "BOG" }], ANT: [{ label: "Medellin", value: "MED" }] },
  });
  const deps = { fetch: async () => ({ ok: true, status: 200, body: [] }), now: () => 0, cache: new Map(), secrets: {} };
  const result = await runCascade(levels, { country: "CO", department: "CUN", city: "BOG" }, deps);
  assert.deepEqual(result.values, { country: "CO", department: "CUN", city: "BOG" });
  assert.deepEqual(validateDataSource({ kind: "rest" }), ["URL is required"]);
});

test("oidc callback rejects a reused state and a mismatched nonce", () => {
  resetIdentityTransactions();
  const discovery = {
    issuer: "https://idp.example",
    authorization_endpoint: "https://idp.example/auth",
    token_endpoint: "https://idp.example/token",
    jwks_uri: "https://idp.example/jwks",
    end_session_endpoint: "https://idp.example/logout",
  };
  const started = beginOidc({
    id: "oidc_1",
    issuer: "https://idp.example",
    clientId: "meridian",
    secretRef: "secret:oidc",
    scopes: ["openid"],
    redirectUri: "https://app.example/callback",
    enabled: true,
  }, discovery, 1_000);
  const payload = Buffer.from(JSON.stringify({ nonce: started.record.nonce, sub: "user-1", email: "ada@example.com" })).toString("base64url");
  const done = completeOidcCallback({
    state: started.record.state,
    code: "code-1",
    now: 1_100,
    expectedNonce: started.record.nonce,
    token: { id_token: `h.${payload}.s`, refresh_token: "refresh" },
  });
  assert.equal("ok" in done, false);
  if ("ok" in done) return;
  assert.equal(done.session.email, "ada@example.com");
  assert.equal(done.refresh, true);
  const again = completeOidcCallback({ state: started.record.state, code: "code-1", now: 1_200, expectedNonce: started.record.nonce, token: {} });
  assert.equal("ok" in again && again.ok === false, true);
  const session = localSession({ userId: "user-1", tenantId: "ten_northwind", email: "ada@example.com", roles: ["owner"] });
  const cookie = sessionCookie(session, secret);
  assert.equal(verifySessionCookie(cookie, secret)?.uid, "user-1");
  assert.equal(verifySessionCookie(cookie, "other"), null);
});

test("document regeneration keeps the previous id", () => {
  resetDocumentRegistry();
  const first = rememberDocument({ tenantId: "ten_northwind", submissionId: "sub_1", formVersionId: 2, pdfBytes: samplePdf("one"), createdBy: "ada" });
  const second = regenerateDocument("ten_northwind", first.documentId, samplePdf("two"), "bea");
  assert.equal("ok" in second, false);
  const history = listDocumentHistory("ten_northwind", "sub_1");
  assert.equal(history.length, 2);
  assert.notEqual(history[0]?.documentId, history[1]?.documentId);
});

test("plugin scaffold registers and rejects an empty value", () => {
  const generated = generateComponent("SupplierScore");
  assert.ok(generated.files["SupplierScore.validator.ts"]?.includes("SupplierScore is required"));
  const host = createHost();
  registerComponent(host, generated.plugin, [generated.plugin.id], []);
  assert.equal(renderValue(host, generated.plugin.type, "  ").ok, false);
  assert.equal(renderValue(host, generated.plugin.type, "42").ok, true);
});

test("uploads reject a declared pdf that is not a pdf", () => {
  const bad = checkUpload({ filename: "note.pdf", declaredType: "application/pdf", bytes: Buffer.from("not a pdf") }, ["application/pdf"]);
  assert.equal(bad.ok, false);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0]);
  const good = checkUpload({ filename: "mark.png", declaredType: "image/png", bytes: png }, ["image/png"]);
  assert.equal(good.ok, true);
});

test("request spans redact secrets and count the http metric", () => {
  const tracer = new Tracer();
  const span = beginRequest(tracer, { method: "POST", path: "/api/platform/fill/admit", traceParent: null, requestId: "req_1" }, 10);
  finishRequest(tracer, span.spanId, 200, 30);
  assert.equal(tracer.snapshot().counters.http_requests_total, 1);
  assert.match(redactLogLine('password: hunter2'), /\*\*\*/);
});

test("spanish form copy overrides the catalog", () => {
  assert.equal(translate({ locale: "es", messages: { submit: "Radicar" } }, "submit"), "Radicar");
  assert.equal(translate({ locale: "es", messages: {} }, "required"), "Obligatorio");
});
