import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { backupFromRows, verifyBackup } from "./backup.mjs";
import { planRestore } from "./restore.mjs";

test("a fixture backup verifies and detects a changed row", () => {
  const files = backupFromRows({
    tenants: [{ id: "ten_northwind", name: "Northwind" }],
    forms: [{ id: "form_1", tenant_id: "ten_northwind" }],
    submissions: [],
  });
  assert.equal(verifyBackup(files).ok, true);
  files["forms.jsonl"] = files["forms.jsonl"].replace("form_1", "form_2");
  assert.equal(verifyBackup(files).ok, false);
});

test("a backup directory restores in table order after the checksums match", () => {
  const files = backupFromRows({
    tenants: [{ id: "ten_northwind" }],
    forms: [{ id: "form_1" }],
    form_versions: [{ form_id: "form_1", version: 1 }],
    submissions: [{ id: "sub_1" }],
    workflow_tasks: [],
    generated_documents: [],
    audit_events: [],
    jobs: [],
  });
  const dir = mkdtempSync(join(tmpdir(), "meridian-backup-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  const plan = planRestore(dir);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.statements.map((item) => item.table), ["tenants", "forms", "form_versions", "submissions", "workflow_tasks", "generated_documents", "audit_events", "jobs"]);
  assert.equal(plan.statements[0].rows, 1);
});
