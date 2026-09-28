import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../platform/durable.ts";
import { hashPassword } from "./passwords.ts";
import { loginUser, readSession, revokeSession } from "./sessions.ts";

function wrap(pg: PGlite): Queryable {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

test("login locks after repeated failures and a revoked session does not read", async () => {
  const pg = new PGlite(mkdtempSync(join(tmpdir(), "meridian-session-")));
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  const db = wrap(pg);
  await db.query("insert into tenants (id, name) values ('ten_a','A')");
  const hash = await hashPassword("correct-horse");
  await db.query(
    "insert into users (id, tenant_id, email, name, password_hash, role) values ('usr_a','ten_a','ada@example.com','Ada',$1,'owner')",
    [hash],
  );
  for (let i = 0; i < 4; i += 1) {
    const failed = await loginUser(db, { email: "ada@example.com", password: "wrong" });
    assert.equal(failed.ok, false);
  }
  const locked = await loginUser(db, { email: "ada@example.com", password: "wrong" });
  assert.equal(locked.ok, false);
  if (!locked.ok) assert.equal(locked.code, "LOCKED");
  await db.query("update users set failed_logins = 0, locked = false, locked_until = null where id = 'usr_a'");
  const ok = await loginUser(db, { email: "Ada@example.com", password: "correct-horse" });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  const session = await readSession(db, ok.session.token);
  assert.equal(session?.tenantId, "ten_a");
  assert.equal(await revokeSession(db, ok.session.token), true);
  assert.equal(await readSession(db, ok.session.token), null);
  const audits = await db.query<{ action: string }>("select action from audit_events where tenant_id = 'ten_a' order by seq");
  assert.ok(audits.some((row) => row.action === "login.failed"));
  assert.ok(audits.some((row) => row.action === "login"));
  assert.ok(audits.some((row) => row.action === "logout"));
  await pg.close();
});
