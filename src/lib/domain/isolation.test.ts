import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { ownsPreviewSnapshot } from "../authz/tenant-scope.ts";
import { publishForm, submitForm, completeWorkflowTask } from "./commands.ts";
import type { FormDefinition } from "../forms/types.ts";
import type { Queryable } from "../platform/durable.ts";
import { authenticatePresentedKey, issueApiKey, present, revokeApiKey, rotateApiKey } from "../platform/api-keys.ts";

function wrap(pg: PGlite): Queryable {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

async function db(): Promise<{ pg: PGlite; sql: Queryable }> {
  const pg = new PGlite(mkdtempSync(join(tmpdir(), "meridian-iso-")));
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  await wrap(pg).query("insert into tenants (id, name) values ('ten_northwind', 'Northwind'), ('ten_contoso', 'Contoso')");
  return { pg, sql: wrap(pg) };
}

function draft(): FormDefinition {
  const now = "2026-09-28T12:00:00.000Z";
  return {
    id: "frm_iso",
    name: "intake",
    title: "Intake",
    description: "",
    display: "form",
    status: "draft",
    version: 1,
    hasUnpublishedChanges: true,
    components: [{ id: "c1", type: "textfield", key: "legalName", label: "Legal name", required: true }],
    settings: { submitLabel: "Submit", draftLabel: "Save", successMessage: "Received.", allowDraft: true },
    tags: [],
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

test("an API key cannot complete, rotate, or revoke another tenant's records", async () => {
  const { pg, sql } = await db();
  assert.equal(ownsPreviewSnapshot("ten_northwind"), true);
  assert.equal(ownsPreviewSnapshot("ten_contoso"), false);
  await publishForm(sql, "ten_northwind", draft(), "ada", "First");
  await submitForm(sql, "ten_northwind", { ...draft(), status: "published", version: 1 }, { data: { legalName: "Andes" }, actor: "ana" });
  const tasks = await sql.query<{ id: string; status: string }>("select id, status from workflow_tasks where tenant_id = $1", ["ten_northwind"]);
  const taskId = tasks[0]!.id;
  const north = await issueApiKey(sql, { tenantId: "ten_northwind", name: "north", role: "owner", scopes: ["agent.execute"] });
  const south = await issueApiKey(sql, { tenantId: "ten_contoso", name: "south", role: "owner", scopes: ["agent.execute"] });
  const northAuth = await authenticatePresentedKey(sql, present(north));
  const southAuth = await authenticatePresentedKey(sql, present(south));
  assert.equal(northAuth?.tenantId, "ten_northwind");
  assert.equal(southAuth?.tenantId, "ten_contoso");
  const stolen = await completeWorkflowTask(sql, southAuth!.tenantId, { taskId, actor: south.publicId, decision: "approve" });
  assert.equal(stolen.ok, false);
  if (!stolen.ok) assert.equal(stolen.code, "NOT_FOUND");
  const still = await sql.query<{ status: string }>("select status from workflow_tasks where id = $1 and tenant_id = $2", [taskId, "ten_northwind"]);
  assert.equal(still[0]?.status, "open");
  assert.equal(await rotateApiKey(sql, "ten_contoso", north.publicId), null);
  assert.equal(await revokeApiKey(sql, "ten_contoso", north.publicId), false);
  const stillNorth = await authenticatePresentedKey(sql, present(north));
  assert.equal(stillNorth?.tenantId, "ten_northwind");
  const leaked = await sql.query("select id from workflow_tasks where tenant_id = $1", ["ten_contoso"]);
  assert.equal(leaked.length, 0);
  await pg.close();
});
