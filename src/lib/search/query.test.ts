import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../platform/durable.ts";
import { searchForms, searchSubmissions } from "./query.ts";
import { maskValue, openValue, sealValue } from "../security/fields.ts";
import { filterDeletable, retentionDecision } from "../retention/policy.ts";
import { createQueuedMail, renderTemplate } from "../notify/template.ts";
import { increment, logEvent, redactDetail, resetMetrics, snapshotMetrics } from "../observe/log.ts";

function wrap(pg: PGlite): Queryable {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

test("search does not cross tenants", async () => {
  const pg = new PGlite(mkdtempSync(join(tmpdir(), "meridian-search-")));
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  const db = wrap(pg);
  await db.query("insert into tenants (id, name) values ('ten_a','A'), ('ten_b','B')");
  await db.query("insert into workspaces (id, tenant_id, name) values ('ws_a','ten_a','A'), ('ws_b','ten_b','B')");
  const now = new Date().toISOString();
  const settings = JSON.stringify({ submitLabel: "Submit", draftLabel: "Save", successMessage: "Ok", allowDraft: true });
  await db.query(
    `insert into forms (id, tenant_id, workspace_id, name, title, description, display, status, version, has_unpublished_changes, schema, settings, created_at, updated_at)
     values ('frm_a','ten_a','ws_a','vendor','Vendor intake','','form','published',1,false,'[]'::jsonb,$1::jsonb,$2,$2),
            ('frm_b','ten_b','ws_b','secret','Secret form','','form','draft',1,true,'[]'::jsonb,$1::jsonb,$2,$2)`,
    [settings, now],
  );
  await db.query("insert into form_tags (tenant_id, form_id, tag) values ('ten_a','frm_a','vendor')");
  await db.query(
    `insert into submissions (id, tenant_id, workspace_id, form_id, form_name, form_version, status, data, created_at, updated_at)
     values ('sub_a','ten_a','ws_a','frm_a','vendor',1,'submitted','{}'::jsonb,$1,$1)`,
    [now],
  );
  const forms = await searchForms(db, "ten_a", { title: "vendor", tag: "vendor" });
  assert.deepEqual(forms.map((item) => item.id), ["frm_a"]);
  assert.equal((await searchForms(db, "ten_a", { title: "secret" })).length, 0);
  const submissions = await searchSubmissions(db, "ten_b", { formId: "frm_a" });
  assert.equal(submissions.length, 0);
  await pg.close();
});

test("sealed fields round-trip and retention respects legal hold", () => {
  const key = randomBytes(32);
  const sealed = sealValue({ nit: "900" }, key, 1);
  assert.equal((openValue(sealed, key) as { nit: string }).nit, "900");
  assert.equal(maskValue("900123456").endsWith("56"), true);
  assert.equal(retentionDecision({ retention: "days", retentionDays: 30, legalHold: true }, "2020-01-01T00:00:00.000Z").reason, "legal-hold");
  const rows = [{ id: "old", createdAt: "2020-01-01T00:00:00.000Z" }, { id: "new", createdAt: new Date().toISOString() }];
  assert.equal(filterDeletable(rows, { retention: "days", retentionDays: 30, legalHold: false }).length, 1);
  assert.equal(filterDeletable(rows, { retention: "days", retentionDays: 30, legalHold: true }).length, 0);
});

test("templates escape html and mail is queued, not sent", async () => {
  const amp = String.fromCharCode(38);
  assert.equal(renderTemplate("Hello {{name}}", { name: "<b>Ana</b>" }), `Hello ${amp}lt;b${amp}gt;Ana${amp}lt;/b${amp}gt;`);
  const pg = new PGlite(mkdtempSync(join(tmpdir(), "meridian-mail-")));
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  await pg.exec(readFileSync(new URL("0001_meridian_platform.sql", root), "utf8"));
  const db = wrap(pg);
  await db.query("insert into tenants (id, name) values ('ten_a','A')");
  const mail = createQueuedMail(db, "ten_a");
  const sent = await mail.send({ to: "ada@example.com", subject: "Review", text: "Please review" });
  assert.equal(sent.ok, true);
  const jobs = await db.query<{ queue: string }>("select queue from jobs where tenant_id = 'ten_a'");
  assert.equal(jobs[0]?.queue, "email");
  const bad = await mail.send({ to: "not-an-email", subject: "x", text: "y" });
  assert.equal(bad.ok, false);
  await pg.close();
});

test("logs redact secrets and metrics count", () => {
  resetMetrics();
  const event = logEvent({ level: "info", service: "api", event: "submit", detail: { password: "hunter2", form: "vendor" } });
  assert.equal(event.detail?.password, "[redacted]");
  assert.equal(event.detail?.form, "vendor");
  assert.equal(redactDetail({ api_key: "abc" })?.api_key, "[redacted]");
  increment("submit");
  increment("submit");
  assert.equal(snapshotMetrics().submit, 2);
});
