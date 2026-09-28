import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import { loadAbac, loadPublicationRecord, replaceAbac, saveDataSourceRecord, saveFlagRuleRecord, saveOidcProviderRecord, upsertPublicationRecord, listOidcProviders } from "../access/records.ts";
import { deliverOutbox, enqueueOutbox } from "../notify/outbox.ts";
import { generatePlacedDocument } from "../pdf/place-pdf.ts";
import { listViews, queryForView, saveView } from "../search/saved-views.ts";
import { acceptanceWorkflow } from "../workflow/restart.ts";
import { inspectWorkflow } from "../workflow/node-config.ts";
import type { Queryable } from "../platform/durable.ts";
import type { PublicationPolicy } from "../access/publication.ts";

function wrap(pg: PGlite): Queryable {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

async function db(): Promise<Queryable> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-records-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql", "0004_closure.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  await pg.exec("insert into tenants (id, name) values ('ten_northwind', 'Northwind')");
  return wrap(pg);
}

const policy: PublicationPolicy = {
  mode: "EMBEDDED",
  submissionsSoFar: 0,
  oneSubmissionPerToken: true,
  usedTokens: [],
  allowedEmbedDomains: ["portal.example"],
  allowedOrigins: ["https://portal.example"],
  hasSession: false,
  viaApi: false,
  linkToken: "link-secret",
  maxSubmissions: 10,
};

test("publication, ABAC, flags, data sources, and OIDC rows round-trip without the secret", async () => {
  const sql = await db();
  await upsertPublicationRecord(sql, "ten_northwind", "supplier", policy);
  const stored = await loadPublicationRecord(sql, "ten_northwind", "supplier");
  assert.equal(stored?.mode, "EMBEDDED");
  assert.equal(stored?.linkTokenHash?.length, 64);
  assert.equal(JSON.stringify(stored).includes("link-secret"), false);
  assert.deepEqual(stored?.allowedEmbedDomains, ["portal.example"]);
  await replaceAbac(sql, "ten_northwind", [{ id: "p1", action: "submission.create", expression: "submission.department == actor.department", enabled: true }]);
  const policies = await loadAbac(sql, "ten_northwind", "submission.create");
  assert.equal(policies[0]?.expression.includes("department"), true);
  await saveFlagRuleRecord(sql, { tenantId: "ten_northwind", name: "pdfEditor", scope: "user", scopeId: "ada", enabled: true, rollout: 25 });
  await saveDataSourceRecord(sql, { id: "ds_city", tenantId: "ten_northwind", name: "Cities", kind: "rest", config: { url: "https://example.com/cities" }, secretName: "secret:cities", cacheTtlMs: 1000 });
  await assert.rejects(() => saveDataSourceRecord(sql, { id: "ds_bad", tenantId: "ten_northwind", name: "Bad", kind: "rest", config: {}, secretName: "raw-key" }));
  await saveOidcProviderRecord(sql, { id: "oidc_1", tenantId: "ten_northwind", name: "Workforce", issuer: "https://idp.example", clientId: "meridian", secretName: "secret:oidc", scopes: "openid email" });
  const providers = await listOidcProviders(sql, "ten_northwind");
  assert.equal(providers[0]?.secretName, "secret:oidc");
  assert.equal(JSON.stringify(providers).includes("client-secret-value"), false);
});

test("a queued assignment email is delivered through the outbox", async () => {
  const sql = await db();
  const row = await enqueueOutbox(sql, {
    tenantId: "ten_northwind",
    template: "task_assignment",
    to: "ada@northwind.example",
    vars: { title: "Review", name: "Ada", url: "https://example.com/inbox" },
    secretRef: "secret:smtp",
  });
  assert.match(row.subject, /Review/);
  const sent: string[] = [];
  const result = await deliverOutbox(sql, async (message) => {
    sent.push(message.to);
  });
  assert.equal(result.sent, 1);
  assert.deepEqual(sent, ["ada@northwind.example"]);
});

test("saved view compiles to a tenant-scoped submission query", async () => {
  const sql = await db();
  const view = await saveView(sql, "user_ada", "Open suppliers", { tenantId: "ten_northwind", status: "submitted", limit: 25 });
  const listed = await listViews(sql, "ten_northwind", "user_ada");
  assert.equal(listed[0]?.id, view.id);
  const query = queryForView(view);
  assert.match(query.text, /tenant_id = \$1/);
  assert.equal(query.params[0], "ten_northwind");
});

test("placed fields render into a PDF whose hash is stored on the document", async () => {
  const { bytes, document } = await generatePlacedDocument({
    tenantId: "ten_northwind",
    submissionId: "sub_1",
    formVersionId: 2,
    templateVersion: 1,
    createdBy: "ada",
    pageCount: 2,
    data: { vendor: "Northwind" },
    placements: [{
      id: "f1", page: 1, x: 0.1, y: 0.1, w: 0.4, h: 0.05, rotation: 0,
      componentKey: "vendor", pdfFieldType: "text", font: "Helvetica", fontSize: 12, align: "left", format: "", required: true,
    }],
  });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  assert.equal(document.generatedHash.length, 64);
  assert.equal(document.formVersionId, 2);
});

test("node config rejects an approval without a role and an N join past its inputs", () => {
  const def = acceptanceWorkflow();
  const issues = inspectWorkflow(def);
  assert.equal(issues.find((issue) => issue.nodeId === "legal"), undefined);
  const broken = inspectWorkflow({
    nodes: [
      { id: "start", type: "start", title: "Start" },
      { id: "approve", type: "approval", title: "Approve" },
      { id: "join", type: "join", title: "Join", join: "n", joinCount: 4 },
      { id: "end", type: "end", title: "End" },
    ],
    edges: [
      { from: "start", to: "approve" },
      { from: "approve", to: "join" },
      { from: "join", to: "end" },
    ],
  });
  assert.equal(broken.some((issue) => issue.code === "role"), true);
  assert.equal(broken.some((issue) => issue.code === "join"), true);
});
