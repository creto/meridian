import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { jwtVerify, importSPKI } from "jose";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import {
  appendAudit,
  authenticateApiKey,
  claimDueJobs,
  createApiKey,
  enqueueJob,
  enqueueWebhook,
  finishJob,
  getSecret,
  loadWorkspace,
  login,
  recordWebhookAttempt,
  revokeApiKey,
  saveWorkspace,
  seedPlatform,
  verifyAuditChain,
} from "./durable.ts";
import type { Queryable } from "./durable.ts";
import { mintGcsAssertion } from "../storage/gcs-jwt.ts";
import { blockedTarget } from "../storage/ssrf.ts";
import { applyHumanAction, scheduleTimer, splitParallel, timerDue } from "../forms/gateways.ts";
import { advanceServices } from "../forms/workflow-run.ts";
import type { FormDefinition, Submission } from "../forms/types.ts";
import { handleMcpMessage } from "./mcp-runtime.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
  };
}

async function freshDb(): Promise<{ db: Queryable; pg: PGlite; dir: string; key: Buffer }> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-pg-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const sql = readFileSync(new URL("../../../migrations/0001_meridian_platform.sql", import.meta.url), "utf8");
  await pg.exec(sql);
  const db = wrap(pg);
  const key = randomBytes(32);
  await seedPlatform(db, key);
  return { db, pg, dir, key };
}

test("tenant isolation, hashed api keys, encrypted secrets, and restart", async () => {
  const first = await freshDb();
  await saveWorkspace(first.db, "ten_northwind", { revision: 2, forms: [{ id: "a" }], submissions: [{ id: "s1" }], idempotency: [] });
  await saveWorkspace(first.db, "ten_contoso", { revision: 1, forms: [{ id: "b" }], submissions: [], idempotency: [] });
  const north = await loadWorkspace(first.db, "ten_northwind");
  const contoso = await loadWorkspace(first.db, "ten_contoso");
  assert.equal((north?.forms[0] as { id: string }).id, "a");
  assert.equal((contoso?.forms[0] as { id: string }).id, "b");
  assert.equal(await getSecret(first.db, first.key, "ten_northwind", "demo-note"), "northwind-only");
  assert.equal(await getSecret(first.db, first.key, "ten_contoso", "demo-note"), "contoso-only");
  const issued = await createApiKey(first.db, "ten_northwind", "cli", ["form.read"]);
  assert.match(issued.token, /^mdn_live_/);
  const auth = await authenticateApiKey(first.db, issued.token);
  assert.equal(auth?.tenantId, "ten_northwind");
  assert.equal(await revokeApiKey(first.db, "ten_contoso", issued.publicId), false);
  assert.equal(await revokeApiKey(first.db, "ten_northwind", issued.publicId), true);
  assert.equal(await authenticateApiKey(first.db, issued.token), null);
  const session = await login(first.db, "ada@northwind.example", "meridian-demo");
  assert.equal(session?.tenantId, "ten_northwind");
  assert.equal(await login(first.db, "ada@northwind.example", "wrong"), null);
  const chain = await verifyAuditChain(first.db, "ten_northwind");
  assert.equal(chain.ok, true);
  assert.ok(chain.checked >= 2);
  await first.pg.close();
  const reopened = new PGlite(first.dir);
  await reopened.waitReady;
  const again = await loadWorkspace(wrap(reopened), "ten_northwind");
  assert.equal((again?.submissions[0] as { id: string }).id, "s1");
  await reopened.close();
});

test("jobs claim and webhook attempts become dead letters", async () => {
  const { db, pg } = await freshDb();
  const id = await enqueueJob(db, "ten_northwind", "workflow", { kind: "timer" }, new Date(Date.now() - 1000));
  const claimed = await claimDueJobs(db);
  assert.equal(claimed[0]?.id, id);
  assert.equal(claimed[0]?.tenant_id, "ten_northwind");
  await finishJob(db, id, false, "temporary");
  const delivery = await enqueueWebhook(db, "ten_northwind", "hook_1", "submission.created", { id: "s" });
  let status = "";
  for (let i = 0; i < 7; i += 1) status = await recordWebhookAttempt(db, delivery, false, "down");
  assert.equal(status, "dead");
  const delivered = await enqueueWebhook(db, "ten_contoso", "hook_2", "submission.created", { id: "other" });
  assert.equal(await recordWebhookAttempt(db, delivered, true), "delivered");
  await appendAudit(db, "ten_contoso", { actor: "ben", action: "webhook.dead", target: delivery });
  const north = await verifyAuditChain(db, "ten_northwind");
  const south = await verifyAuditChain(db, "ten_contoso");
  assert.equal(north.ok, true);
  assert.equal(south.ok, true);
  await pg.close();
});

test("timer fires when due and parallel branches join", async () => {
  const form: FormDefinition = {
    id: "frm",
    name: "gate",
    title: "Gate",
    description: "",
    version: 1,
    status: "published",
    display: "form",
    hasUnpublishedChanges: false,
    components: [],
    settings: { submitLabel: "Submit", draftLabel: "Draft", successMessage: "ok", allowDraft: true },
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [],
    activity: [],
    pdfPages: 1,
    workflow: {
      nodes: [
        { id: "start", type: "start", title: "Start" },
        { id: "wait", type: "timer", title: "Wait", delayMs: 60_000 },
        { id: "split", type: "parallel", title: "Split" },
        { id: "a", type: "human", title: "A", role: "Reviewer" },
        { id: "b", type: "human", title: "B", role: "Reviewer" },
        { id: "join", type: "join", title: "Join", join: "all" },
        { id: "end", type: "end", title: "Approved" },
      ],
      edges: [
        { from: "start", to: "wait" },
        { from: "wait", to: "split" },
        { from: "split", to: "a" },
        { from: "split", to: "b" },
        { from: "a", to: "join", when: "approved" },
        { from: "b", to: "join", when: "approved" },
        { from: "join", to: "end", when: "approved" },
      ],
    },
  };
  const plan = scheduleTimer(60_000, 1_000);
  assert.equal(plan.fireNow, false);
  assert.equal(timerDue(plan.waitUntil, 1_000), false);
  assert.equal(timerDue(plan.waitUntil, 61_000), true);
  const submission: Submission = {
    id: "sub",
    formId: form.id,
    formName: form.name,
    formVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "in_review",
    data: {},
    revisions: [],
    documents: [],
    workflow: { currentNode: "wait", history: [], waitUntil: new Date(Date.now() - 1000).toISOString() },
  };
  const fired = await advanceServices(form, submission, "timer");
  assert.equal(fired.workflow?.history.some((event) => event.action === "timer-fired"), true);
  assert.equal(fired.workflow?.history.some((event) => event.action === "split"), true);
  assert.equal(fired.workflow?.tokens?.length, 2);
  assert.equal(fired.workflow?.currentNode, "a");
  const one = applyHumanAction(form, fired.workflow!, "approve", "ada", "", new Date().toISOString());
  assert.notEqual(one.currentNode, "end");
  const both = applyHumanAction(form, one, "approve", "ada", "", new Date().toISOString());
  assert.equal(both.currentNode, "end");
  assert.equal(both.history.some((event) => event.action === "joined"), true);
  const direct = splitParallel(form, "split");
  assert.equal(direct.length, 2);
});

test("GCS service-account assertion verifies and private hosts are blocked", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const spki = publicKey.export({ type: "spki", format: "pem" }).toString();
  const now = Date.now();
  const assertion = await mintGcsAssertion("worker@example.iam.gserviceaccount.com", pem, now);
  const verified = await jwtVerify(assertion, await importSPKI(spki, "RS256"), {
    issuer: "worker@example.iam.gserviceaccount.com",
    audience: "https://oauth2.googleapis.com/token",
    currentDate: new Date(now),
  });
  assert.equal(verified.payload.scope, "https://www.googleapis.com/auth/devstorage.full_control");
  assert.match(blockedTarget("http://169.254.169.254/latest") ?? "", /blocked/i);
  assert.equal(blockedTarget("https://storage.example.com/files"), null);
  assert.equal(blockedTarget("http://127.0.0.1:9000/bucket", true), null);
});

test("MCP runtime lists tools and rejects unknown methods", async () => {
  const listed = await Promise.resolve(handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, [], async () => ({})));
  assert.equal(Array.isArray((listed as { result: { tools: unknown[] } }).result.tools), true);
  const missing = await Promise.resolve(handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "nope" }, [], async () => ({})));
  assert.equal((missing as { error: { code: number } }).error.code, -32601);
  const called = await handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "forms.list", arguments: {} } }, [], async (name) => ({ name }));
  assert.match(JSON.stringify(called), /forms.list/);
});
