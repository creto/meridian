import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { recordGeneration, listGenerations } from "../ai/history.ts";
import { saveSubmissionDraft, loadSubmissionDraft, revokeSubmissionDraft } from "../drafts/resume.ts";
import { archiveForm, listSubmissionRevisions, reviseSubmission } from "./revisions.ts";
import { claimNextJob, runClaimedJob } from "../jobs/dispatch.ts";
import { generateMappedPdf, registerPdfTemplate } from "../pdf/documents.ts";
import { placeFieldsOnBlank } from "../pdf/acroform.ts";
import type { Queryable } from "../platform/durable.ts";
import { repositories } from "../repos/postgres.ts";
import { enqueueSignedDelivery } from "../platform/webhook-sign.ts";
import { deliverDueWebhooks } from "../webhooks/pump.ts";
import { verifyWebhook } from "../platform/webhook-sign.ts";

function wrap(pg: PGlite): Queryable {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

async function db(): Promise<Queryable> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-suite-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  return wrap(pg);
}

test("repositories do not leak forms, profiles or flags across tenants", async () => {
  const sql = await db();
  const a = repositories(sql, "ten_repo_a");
  const b = repositories(sql, "ten_repo_b");
  await a.forms.upsert({ id: "frm_a", name: "alpha", title: "Alpha", schema: [{ key: "name" }], tags: ["vendor"] });
  await a.storage.save({ id: "stp_a", name: "bucket", kind: "s3", config: { bucket: "a" } });
  await a.flags.set("beta", true);
  assert.equal(await b.forms.get("frm_a"), null);
  assert.equal((await a.forms.get("frm_a"))?.title, "Alpha");
  assert.equal(await b.storage.get("stp_a"), null);
  assert.equal(await b.flags.get("beta"), false);
  assert.equal(await a.flags.get("beta"), true);
});

test("draft tokens are hashed and tenant scoped", async () => {
  const sql = await db();
  const saved = await saveSubmissionDraft(sql, "ten_draft", "frm_1", { name: "Ada" });
  const loaded = await loadSubmissionDraft(sql, "ten_draft", saved.token);
  assert.equal(loaded?.data.name, "Ada");
  assert.equal(await loadSubmissionDraft(sql, "ten_other", saved.token), null);
  assert.equal(await revokeSubmissionDraft(sql, "ten_draft", saved.id), true);
  assert.equal(await loadSubmissionDraft(sql, "ten_draft", saved.token), null);
});

test("job dispatch completes or dead-letters", async () => {
  const sql = await db();
  await sql.query("insert into tenants (id, name) values ('ten_job', 'Job')");
  await sql.query("insert into jobs (id, tenant_id, queue, status, payload, max_attempts, run_at) values ('job_ok', 'ten_job', 'email', 'queued', '{}'::jsonb, 3, now() - interval '2 minutes')");
  await sql.query("insert into jobs (id, tenant_id, queue, status, payload, max_attempts, run_at) values ('job_bad', 'ten_job', 'email', 'queued', '{}'::jsonb, 1, now() - interval '1 minute')");
  const ok = await claimNextJob(sql, ["email"]);
  assert.ok(ok);
  assert.equal(await runClaimedJob(sql, ok!, { email: async () => undefined }), "completed");
  const bad = await claimNextJob(sql, ["email"]);
  assert.equal(bad?.id, "job_bad");
  assert.equal(await runClaimedJob(sql, bad!, { email: async () => { throw new Error("smtp down"); } }), "dead");
  const dead = await sql.query<{ status: string }>("select status from jobs where id = 'job_bad'");
  assert.equal(dead[0]?.status, "dead");
});

test("webhook pump signs the body and records delivery", async () => {
  const sql = await db();
  await sql.query("insert into tenants (id, name) values ('ten_hook', 'Hook')");
  await sql.query(
    "insert into webhook_endpoints (id, tenant_id, url, secret_name, events) values ('wh_1', 'ten_hook', 'https://example.com/hooks', 'hook', '[\"submission.created\"]'::jsonb)",
  );
  await enqueueSignedDelivery(sql, { tenantId: "ten_hook", endpointId: "wh_1", event: "submission.created", payload: { id: "s1" } });
  let seen = "";
  const result = await deliverDueWebhooks(sql, {
    resolveSecret: async () => "topsecret",
    fetchImpl: async (_url, init) => {
      seen = String(init?.body ?? "");
      const headers = init?.headers as Record<string, string>;
      assert.equal(verifyWebhook("topsecret", seen, Number(headers["x-meridian-timestamp"]), headers["x-meridian-signature"]), true);
      return new Response("ok", { status: 200 });
    },
  });
  assert.equal(result.delivered, 1);
  assert.match(seen, /s1/);
});

test("submission revision conflicts and form archive stay in tenant", async () => {
  const sql = await db();
  await sql.query("insert into tenants (id, name) values ('ten_rev', 'Rev')");
  await sql.query("insert into workspaces (id, tenant_id, name) values ('ws_ten_rev', 'ten_rev', 'Rev')");
  const stamp = "2026-09-28T12:00:00.000Z";
  await sql.query(
    `insert into submissions (id, tenant_id, workspace_id, form_id, form_name, form_version, status, data, created_at, updated_at)
     values ('sub_1', 'ten_rev', 'ws_ten_rev', 'frm', 'intake', 1, 'submitted', '{"name":"A"}'::jsonb, $1, $1)`,
    [stamp],
  );
  await sql.query(
    `insert into forms (id, tenant_id, workspace_id, name, title, description, display, status, version, schema, settings, created_at, updated_at)
     values ('frm', 'ten_rev', 'ws_ten_rev', 'intake', 'Intake', '', 'form', 'published', 1, '[]'::jsonb, '{}'::jsonb, $1, $1)`,
    [stamp],
  );
  const revised = await reviseSubmission(sql, "ten_rev", { submissionId: "sub_1", expectedUpdatedAt: stamp, data: { name: "B" }, actor: "ada" });
  assert.equal(revised.ok, true);
  const conflict = await reviseSubmission(sql, "ten_rev", { submissionId: "sub_1", expectedUpdatedAt: stamp, data: { name: "C" }, actor: "ben" });
  assert.equal(conflict.code, "CONFLICT");
  assert.equal((await listSubmissionRevisions(sql, "ten_other", "sub_1")).length, 0);
  assert.equal((await archiveForm(sql, "ten_other", "frm", "ada")).code, "NOT_FOUND");
  assert.equal((await archiveForm(sql, "ten_rev", "frm", "ada")).ok, true);
});

test("pdf template hash is checked before fill", async () => {
  const sql = await db();
  const bytes = await placeFieldsOnBlank({
    title: "Contract",
    pages: 1,
    fields: [{ name: "LegalName", page: 0, x: 0.1, y: 0.2, w: 0.4, h: 0.05, kind: "text" }],
  });
  const registered = await registerPdfTemplate(sql, "ten_pdf", {
    name: "Contract",
    bytes,
    mappings: [{ pdfField: "LegalName", formKey: "legalName", fieldType: "text" }],
  });
  const generated = await generateMappedPdf(sql, "ten_pdf", {
    templateId: registered.templateId,
    version: 1,
    sourceBytes: bytes,
    data: { legalName: "Ada North" },
    submissionId: "sub_pdf",
    formVersion: 1,
    submissionRevision: 1,
    flatten: true,
  });
  assert.equal(generated.filled.includes("LegalName"), true);
  assert.notEqual(generated.sha256, registered.sha256);
  const wrong = Uint8Array.from(bytes);
  wrong[20] = wrong[20]! ^ 0xff;
  await assert.rejects(() => generateMappedPdf(sql, "ten_pdf", {
    templateId: registered.templateId,
    version: 1,
    sourceBytes: wrong,
    data: { legalName: "Ada" },
    submissionId: "sub_pdf_2",
    formVersion: 1,
    submissionRevision: 1,
  }));
});

test("generation history is tenant scoped and redacts secrets", async () => {
  const sql = await db();
  await recordGeneration(sql, "ten_ai", { provider: "grok", model: "grok-4", promptVersion: "v1", prompt: "bearer secret-token design a form", result: { title: "Intake" } });
  const own = await listGenerations(sql, "ten_ai");
  assert.equal(own.length, 1);
  assert.match(own[0]!.prompt, /\*\*\*/);
  assert.equal((await listGenerations(sql, "ten_other")).length, 0);
});
