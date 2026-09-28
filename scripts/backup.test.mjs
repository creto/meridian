import assert from "node:assert/strict";
import test from "node:test";
import { backupFromRows, verifyBackup } from "./backup.mjs";

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
