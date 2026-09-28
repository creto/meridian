import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../platform/durable.ts";
import { publishForm, submitForm, completeWorkflowTask } from "./commands.ts";
import type { FormDefinition } from "../forms/types.ts";
import { authorize } from "../authz/authorize.ts";
import { hashPassword, verifyPassword, hashPasswordScrypt, schemeOf } from "../identity/passwords.ts";
import { authenticatePresentedKey, issueApiKey, present, revokeApiKey, rotateApiKey } from "../platform/api-keys.ts";
import { enqueueSignedDelivery, recordSignedAttempt, signWebhook, verifyWebhook } from "../platform/webhook-sign.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
}

async function db(): Promise<{ pg: PGlite; sql: Queryable }> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-cmd-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  return { pg, sql: wrap(pg) };
}

function draft(): FormDefinition {
  const now = "2026-09-28T12:00:00.000Z";
  return {
    id: "frm_cmd",
    name: "intake",
    title: "Intake",
    description: "",
    display: "form",
    status: "draft",
    version: 1,
    hasUnpublishedChanges: true,
    components: [{ id: "c1", type: "textfield", key: "legalName", label: "Legal name", required: true }],
    settings: { submitLabel: "Submit", draftLabel: "Save", successMessage: "Received.", allowDraft: true },
    tags: ["vendor"],
    createdAt: now,
    updatedAt: now,
    versions: [],
    activity: [],
    pdfPages: 1,
    workflow: {
      nodes: [
        { id: "start", type: "start", title: "Submitted" },
        { id: "review", type: "human", title: "Review", role: "Reviewer" },
        { id: "done", type: "end", title: "Approved" },
      ],
      edges: [{ from: "start", to: "review" }, { from: "review", to: "done", when: "approved" }],
    },
  };
}

test("publish, submit, and complete stay inside one tenant", async () => {
  const { pg, sql } = await db();
  const form = draft();
  const published = await publishForm(sql, "ten_northwind", form, "ada", "First");
  assert.equal(published.ok, true);
  assert.equal(published.version, 1);
  const again = await publishForm(sql, "ten_northwind", { ...form, status: "published", version: 1, hasUnpublishedChanges: false }, "ada", "Again");
  assert.equal(again.version, 1);
  const submitted = await submitForm(sql, "ten_northwind", { ...form, status: "published", version: 1 }, {
    data: { legalName: "Andes" },
    actor: "ana",
    idempotencyKey: "intake-andes",
  });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.submission?.data.legalName, "Andes");
  const replay = await submitForm(sql, "ten_northwind", { ...form, status: "published", version: 1 }, {
    data: { legalName: "Andes" },
    actor: "ana",
    idempotencyKey: "intake-andes",
  });
  assert.equal(replay.replay, true);
  const conflict = await submitForm(sql, "ten_northwind", { ...form, status: "published", version: 1 }, {
    data: { legalName: "Other" },
    actor: "ana",
    idempotencyKey: "intake-andes",
  });
  assert.equal(conflict.code, "IDEMPOTENCY_CONFLICT");
  const tasks = await sql.query<{ id: string }>("select id from workflow_tasks where tenant_id = $1", ["ten_northwind"]);
  const done = await completeWorkflowTask(sql, "ten_contoso", { taskId: tasks[0]!.id, actor: "ben", decision: "approve" });
  assert.equal(done.ok, false);
  if (!done.ok) assert.equal(done.code, "NOT_FOUND");
  const ok = await completeWorkflowTask(sql, "ten_northwind", { taskId: tasks[0]!.id, actor: "ada", decision: "approve", comment: "yes" });
  assert.equal(ok.ok, true);
  const twice = await completeWorkflowTask(sql, "ten_northwind", { taskId: tasks[0]!.id, actor: "ada", decision: "approve" });
  assert.equal(twice.ok, false);
  const leaked = await sql.query("select id from submissions where tenant_id = $1", ["ten_contoso"]);
  assert.equal(leaked.length, 0);
  await pg.close();
});

test("a reviewer cannot publish another tenant's form", () => {
  const decision = authorize({
    actor: { tenantId: "ten_a", userId: "u1", role: "reviewer" },
    action: "form.publish",
    resource: { tenantId: "ten_b", type: "form", id: "frm" },
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, "wrong-tenant");
  const own = authorize({
    actor: { tenantId: "ten_a", userId: "u1", role: "reviewer" },
    action: "workflow.task.complete",
    resource: { tenantId: "ten_a", type: "task" },
  });
  assert.equal(own.allow, true);
  const clerk = authorize({
    actor: { tenantId: "ten_a", userId: "u2", role: "clerk" },
    action: "form.publish",
    resource: { tenantId: "ten_a", type: "form" },
  });
  assert.equal(clerk.allow, false);
});

test("argon2id verifies and scrypt records still verify", async () => {
  const encoded = await hashPassword("correct horse");
  assert.equal(schemeOf(encoded), "argon2id");
  assert.equal(await verifyPassword("correct horse", encoded), true);
  assert.equal(await verifyPassword("nope", encoded), false);
  const legacy = hashPasswordScrypt("legacy");
  assert.equal(await verifyPassword("legacy", legacy), true);
  assert.equal(await verifyPassword("nope", legacy), false);
});

test("api keys are hashed, rotatable, and tenant scoped", async () => {
  const { pg, sql } = await db();
  await sql.query("insert into tenants (id, name) values ('ten_a', 'A'), ('ten_b', 'B')");
  const issued = await issueApiKey(sql, { tenantId: "ten_a", name: "ci", scopes: ["agent.execute"] });
  assert.equal(issued.secret.includes(issued.publicId), false);
  const stored = await sql.query<{ secret_hash: string }>("select secret_hash from api_keys where public_id = $1", [issued.publicId]);
  assert.equal(stored[0]?.secret_hash.includes(issued.secret), false);
  const auth = await authenticatePresentedKey(sql, present(issued));
  assert.equal(auth?.tenantId, "ten_a");
  const rotated = await rotateApiKey(sql, "ten_a", issued.publicId);
  assert.ok(rotated);
  assert.equal(await authenticatePresentedKey(sql, present(issued)), null);
  assert.equal((await authenticatePresentedKey(sql, present(rotated!)))?.tenantId, "ten_a");
  assert.equal(await revokeApiKey(sql, "ten_b", rotated!.publicId), false);
  assert.equal(await revokeApiKey(sql, "ten_a", rotated!.publicId), true);
  await pg.close();
});

test("webhook signatures reject stale timestamps and dead-letter after the schedule", async () => {
  const body = JSON.stringify({ id: "sub_1" });
  const stamp = 1_700_000_000_000;
  const sig = signWebhook("sek", body, stamp);
  assert.equal(verifyWebhook("sek", body, stamp, sig, stamp + 1000), true);
  assert.equal(verifyWebhook("sek", body, stamp, sig, stamp + 10 * 60_000), false);
  assert.equal(verifyWebhook("other", body, stamp, sig, stamp), false);
  const { pg, sql } = await db();
  await sql.query("insert into tenants (id, name) values ('ten_a', 'A')");
  const delivery = await enqueueSignedDelivery(sql, { tenantId: "ten_a", endpointId: "ep1", event: "submission.created", payload: { id: "sub_1" } });
  let state: "delivered" | "retry" | "dead" = "retry";
  for (let i = 0; i < 7; i += 1) {
    state = await recordSignedAttempt(sql, { tenantId: "ten_a", deliveryId: delivery, ok: false, statusCode: 500, error: "down" });
  }
  assert.equal(state, "dead");
  const dead = await sql.query("select id from dead_letter_events where tenant_id = $1", ["ten_a"]);
  assert.equal(dead.length, 1);
  await pg.close();
});
