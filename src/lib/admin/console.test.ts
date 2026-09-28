import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { consoleAct, consoleSnapshot, takeInviteToken } from "./console.ts";
import { loadOverlays, replaceOverlays } from "../pdf/overlay-store.ts";
import { upsertNodeRuns, readNodeRuns } from "../workflow/journal.ts";
import type { Queryable } from "../platform/durable.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
}

async function db(): Promise<Queryable> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-console-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql", "0004_closure.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  return wrap(pg);
}

test("console creates a user, audits it, and never returns the password hash", async () => {
  const sql = await db();
  const created = await consoleAct(sql, "ten_northwind", {
    action: "create-user",
    email: "ada@northwind.example",
    name: "Ada",
    password: "correct-horse",
    actor: "owner",
  });
  assert.equal(created.users.length, 1);
  assert.equal(created.users[0]?.email, "ada@northwind.example");
  assert.equal(JSON.stringify(created).includes("correct-horse"), false);
  assert.equal(created.chain.ok, true);
  assert.equal(created.audit.some((row) => row.action === "user.create"), true);
  const invited = await consoleAct(sql, "ten_northwind", { action: "invite-user", email: "bea@northwind.example", name: "Bea" });
  const taken = takeInviteToken(invited);
  assert.equal(taken.token && taken.token.length > 10, true);
  assert.equal(taken.snapshot.integrations.some((item) => item.kind === "invite-once"), false);
  const disabled = await consoleAct(sql, "ten_northwind", { action: "disable-user", userId: created.users[0]!.id, disabled: true });
  assert.equal(disabled.users.find((user) => user.email.startsWith("ada"))?.disabled, true);
});

test("pdf overlays and workflow node runs survive a reload", async () => {
  const sql = await db();
  await sql.query("insert into tenants (id, name) values ('ten_northwind', 'Northwind') on conflict (id) do nothing");
  const count = await replaceOverlays(sql, "ten_northwind", "tpl_1", 3, [{
    id: "ov_1",
    page: 1,
    x: 0.1,
    y: 0.2,
    w: 0.3,
    h: 0.05,
    rotation: 0,
    componentKey: "vendor",
    pdfFieldType: "text",
    font: "Helvetica",
    fontSize: 11,
    align: "left",
    format: "",
    required: true,
  }]);
  assert.equal(count, 1);
  const loaded = await loadOverlays(sql, "ten_northwind", "tpl_1", 3);
  assert.equal(loaded[0]?.componentKey, "vendor");
  assert.equal(loaded[0]?.x, 0.1);
  await upsertNodeRuns(sql, [{ id: "wnr_1", tenantId: "ten_northwind", submissionId: "sub_1", nodeId: "legal", status: "WAITING", attempts: 0, lastError: null }]);
  const rows = await readNodeRuns(sql, "ten_northwind", "sub_1");
  assert.equal(rows[0]?.status, "WAITING");
});
