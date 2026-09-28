import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { seedPlatform } from "../platform/durable.ts";
import type { Queryable } from "../platform/durable.ts";
import { loadTenantWorkspace, replaceTenantWorkspace } from "./workspace-store.ts";
import type { FormDefinition, Submission } from "../forms/types.ts";
import { randomBytes } from "node:crypto";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
  };
}

function form(id: string, name: string): FormDefinition {
  const now = "2026-09-28T12:00:00.000Z";
  return {
    id,
    name,
    title: name,
    description: "",
    display: "form",
    status: "published",
    version: 1,
    hasUnpublishedChanges: false,
    components: [{ id: `${id}_f`, type: "textfield", key: "legalName", label: "Legal name", required: true }],
    settings: { submitLabel: "Submit", draftLabel: "Save", successMessage: "Received.", allowDraft: true },
    tags: [],
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    versions: [{ version: 1, savedAt: now, note: "Published", title: name, display: "form", components: [{ id: `${id}_f`, type: "textfield", key: "legalName", label: "Legal name" }] }],
    activity: [{ at: now, actor: "ada", message: "Published" }],
    pdfPages: 1,
  };
}

function submission(id: string, formId: string): Submission {
  const now = "2026-09-28T12:05:00.000Z";
  return {
    id,
    formId,
    formName: "supplier",
    formVersion: 1,
    createdAt: now,
    updatedAt: now,
    status: "in_review",
    data: { legalName: "Andes" },
    revisions: [{ at: now, actor: "ana", note: "Filed", data: { legalName: "Andes" } }],
    workflow: { currentNode: "review", history: [{ node: "review", at: now, action: "start", actor: "ana" }] },
    documents: [],
  };
}

test("relational workspace round-trips and does not leak across tenants", async () => {
  const dir = mkdtempSync(join(tmpdir(), "meridian-domain-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  await pg.exec(readFileSync(new URL("0001_meridian_platform.sql", root), "utf8"));
  await pg.exec(readFileSync(new URL("0002_domain.sql", root), "utf8"));
  const db = wrap(pg);
  await seedPlatform(db, randomBytes(32));
  await db.query("insert into tenants (id, name) values ('ten_contoso', 'Contoso') on conflict (id) do nothing");

  await pg.transaction(async (tx) => {
    const scoped = wrap(tx as unknown as PGlite);
    await replaceTenantWorkspace(scoped, "ten_northwind", {
      revision: 3,
      forms: [form("frm_a", "supplier")],
      submissions: [submission("sub_a", "frm_a")],
      idempotency: [{ key: "supplier-andes", hash: "abc", submissionId: "sub_a", at: "2026-09-28T12:05:00.000Z" }],
    });
    await replaceTenantWorkspace(scoped, "ten_contoso", {
      revision: 1,
      forms: [form("frm_b", "secret")],
      submissions: [submission("sub_b", "frm_b")],
      idempotency: [],
    });
  });

  const north = await loadTenantWorkspace(db, "ten_northwind");
  const contoso = await loadTenantWorkspace(db, "ten_contoso");
  const northForm = north?.forms[0] as FormDefinition | undefined;
  const northSubmission = north?.submissions[0] as Submission | undefined;
  const contosoForm = contoso?.forms[0] as FormDefinition | undefined;
  assert.equal(north?.forms.length, 1);
  assert.equal(northForm?.name, "supplier");
  assert.equal(northForm?.versions[0]?.note, "Published");
  assert.equal(northSubmission?.data.legalName, "Andes");
  assert.equal(northSubmission?.workflow?.currentNode, "review");
  assert.equal(northSubmission?.revisions[0]?.actor, "ana");
  assert.equal((north?.idempotency[0] as { key?: string } | undefined)?.key, "supplier-andes");
  assert.equal(contosoForm?.id, "frm_b");
  assert.equal((north?.forms as FormDefinition[]).some((item) => item.id === "frm_b"), false);
  assert.equal((north?.submissions as Submission[]).some((item) => item.id === "sub_b"), false);

  const leaked = await db.query("select id from forms where tenant_id = $1 and id = $2", ["ten_northwind", "frm_b"]);
  assert.equal(leaked.length, 0);
  await pg.close();
});
