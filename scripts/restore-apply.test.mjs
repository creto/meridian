import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { backupFromRows } from "./backup.mjs";
import { applyRestore } from "./restore.mjs";

test("a backup is inserted into Postgres and can be read back", async () => {
  const pg = new PGlite(mkdtempSync(join(tmpdir(), "meridian-restore-")));
  await pg.waitReady;
  const root = new URL("../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  const now = "2026-10-01T12:00:00.000Z";
  const files = backupFromRows({
    tenants: [{ id: "ten_northwind", name: "Northwind" }],
    workspaces: [{ id: "ws_ten_northwind", tenant_id: "ten_northwind", name: "Northwind" }],
    forms: [{
      id: "frm_1",
      tenant_id: "ten_northwind",
      workspace_id: "ws_ten_northwind",
      name: "intake",
      title: "Intake",
      display: "form",
      status: "published",
      version: 1,
      schema: [],
      settings: { submitLabel: "Submit" },
      created_at: now,
      updated_at: now,
    }],
    submissions: [{
      id: "sub_1",
      tenant_id: "ten_northwind",
      workspace_id: "ws_ten_northwind",
      form_id: "frm_1",
      form_name: "intake",
      form_version: 1,
      status: "submitted",
      data: { legalName: "Andes" },
      created_at: now,
      updated_at: now,
    }],
  });
  const dir = mkdtempSync(join(tmpdir(), "meridian-backup-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  const restored = await applyRestore((sql, params) => pg.query(sql, params), dir);
  assert.equal(restored.ok, true);
  const rows = await pg.query("select data->>'legalName' as name from submissions where id = 'sub_1' and tenant_id = 'ten_northwind'");
  assert.equal(rows.rows[0].name, "Andes");
  const again = await applyRestore((sql, params) => pg.query(sql, params), dir);
  assert.equal(again.ok, true);
  const count = await pg.query("select count(*)::int as n from submissions where tenant_id = 'ten_northwind'");
  assert.equal(count.rows[0].n, 1);
  await pg.close();
});
