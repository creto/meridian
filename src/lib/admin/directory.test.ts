import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  analyticsCount,
  assignUserRole,
  createDirectoryUser,
  ensureRole,
  getFlag,
  grantPermission,
  healthCounts,
  listDirectoryUsers,
  recentAudit,
  setFlag,
  setUserDisabled,
  trackAnalytics,
  type Queryable,
} from "./directory.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
}

async function db(): Promise<{ pg: PGlite; sql: Queryable }> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-admin-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  return { pg, sql: wrap(pg) };
}

test("directory users stay inside the tenant", async () => {
  const { pg, sql } = await db();
  try {
    const ada = await createDirectoryUser(sql, "ten_a", {
      email: "  Ada@Example.com ",
      name: "Ada",
      passwordHash: "hash-ada",
      role: "owner",
    });
    assert.match(ada.id, /^usr_[0-9a-f]{16}$/);
    const ben = await createDirectoryUser(sql, "ten_b", {
      email: "ada@example.com",
      name: "Ben",
      passwordHash: "hash-ben",
      role: "owner",
    });
    await createDirectoryUser(sql, "ten_a", {
      email: "cara@example.com",
      name: "Cara",
      passwordHash: "hash-cara",
      role: "member",
    });
    await assert.rejects(
      () => createDirectoryUser(sql, "ten_a", { email: "ADA@example.com", name: "Clone", passwordHash: "x", role: "member" }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "DUPLICATE");
        return true;
      },
    );

    const aUsers = await listDirectoryUsers(sql, "ten_a");
    const bUsers = await listDirectoryUsers(sql, "ten_b");
    assert.deepEqual(aUsers.map((user) => user.email), ["ada@example.com", "cara@example.com"]);
    assert.deepEqual(bUsers.map((user) => user.id), [ben.id]);
    assert.equal(aUsers[0]?.name, "Ada");
    assert.equal(aUsers[0]?.role, "owner");
    assert.equal(aUsers[0]?.disabled, false);
    assert.equal(aUsers[0]?.failed_logins, 0);
    assert.equal(aUsers[0]?.last_login_at, null);
    assert.equal(Object.hasOwn(aUsers[0] ?? {}, "password_hash"), false);
    const stored = await sql.query<{ password_hash: string }>("select password_hash from users where tenant_id = $1 and id = $2", ["ten_a", ada.id]);
    assert.equal(stored[0]?.password_hash, "hash-ada");

    assert.equal(await setUserDisabled(sql, "ten_b", ada.id, true), false);
    const still = await sql.query<{ disabled: boolean }>("select disabled from users where id = $1", [ada.id]);
    assert.equal(still[0]?.disabled, false);
    assert.equal(await setUserDisabled(sql, "ten_a", ada.id, true), true);
    const after = await listDirectoryUsers(sql, "ten_a");
    assert.equal(after.find((user) => user.id === ada.id)?.disabled, true);
    assert.equal(await setUserDisabled(sql, "ten_a", "usr_missing", true), false);
  } finally {
    await pg.close();
  }
});

test("roles and permissions do not cross tenants", async () => {
  const { pg, sql } = await db();
  try {
    const ada = await createDirectoryUser(sql, "ten_a", {
      email: "ada@example.com",
      name: "Ada",
      passwordHash: "h",
      role: "member",
    });
    const ben = await createDirectoryUser(sql, "ten_b", {
      email: "ben@example.com",
      name: "Ben",
      passwordHash: "h",
      role: "member",
    });
    const clerkA = await ensureRole(sql, "ten_a", "clerk");
    const clerkAAgain = await ensureRole(sql, "ten_a", "clerk");
    const clerkB = await ensureRole(sql, "ten_b", "clerk");
    assert.equal(clerkA, clerkAAgain);
    assert.notEqual(clerkA, clerkB);
    assert.match(clerkA, /^rol_[0-9a-f]{16}$/);

    assert.equal(await grantPermission(sql, "ten_a", "missing", "forms.read"), false);
    assert.equal(await grantPermission(sql, "ten_a", "clerk", "forms.read"), true);
    assert.equal(await grantPermission(sql, "ten_a", "clerk", "forms.read"), true);
    const permsA = await sql.query<{ permission: string }>("select permission from role_permissions where role_id = $1", [clerkA]);
    const permsB = await sql.query<{ permission: string }>("select permission from role_permissions where role_id = $1", [clerkB]);
    assert.deepEqual(permsA.map((row) => row.permission), ["forms.read"]);
    assert.deepEqual(permsB, []);

    assert.equal(await assignUserRole(sql, "ten_a", ben.id, "clerk"), false);
    assert.equal(await assignUserRole(sql, "ten_b", ada.id, "clerk"), false);
    assert.equal(await assignUserRole(sql, "ten_a", ada.id, "nope"), false);
    assert.equal(await assignUserRole(sql, "ten_a", ada.id, "clerk"), true);
    assert.equal(await assignUserRole(sql, "ten_a", ada.id, "clerk"), true);
    const links = await sql.query<{ tenant_id: string; role_id: string }>(
      "select tenant_id, role_id from user_roles where user_id = $1",
      [ada.id],
    );
    assert.deepEqual(links, [{ tenant_id: "ten_a", role_id: clerkA }]);
  } finally {
    await pg.close();
  }
});

test("flags, analytics, and audit are tenant scoped", async () => {
  const { pg, sql } = await db();
  try {
    await setFlag(sql, "ten_a", "beta", true);
    await setFlag(sql, "ten_b", "beta", false);
    assert.equal(await getFlag(sql, "ten_a", "beta"), true);
    assert.equal(await getFlag(sql, "ten_b", "beta"), false);
    assert.equal(await getFlag(sql, "ten_a", "missing"), false);
    await setFlag(sql, "ten_a", "beta", false);
    assert.equal(await getFlag(sql, "ten_a", "beta"), false);
    assert.equal(await getFlag(sql, "ten_b", "beta"), false);

    await trackAnalytics(sql, "ten_a", "submit", "frm_1", { ok: true, n: 1 });
    await trackAnalytics(sql, "ten_a", "submit", "frm_1", { ok: false });
    await trackAnalytics(sql, "ten_b", "submit", "frm_x", { ok: true });
    await trackAnalytics(sql, "ten_a", "view", "frm_1", {});
    assert.equal(await analyticsCount(sql, "ten_a", "submit"), 2);
    assert.equal(await analyticsCount(sql, "ten_b", "submit"), 1);
    assert.equal(await analyticsCount(sql, "ten_a", "other"), 0);
    const stored = await sql.query<{ properties: { ok?: boolean } | string }>(
      "select properties from analytics_events where tenant_id = $1 and name = $2 order by created_at asc, id asc",
      ["ten_a", "submit"],
    );
    const first = stored[0]?.properties;
    const props = typeof first === "string" ? (JSON.parse(first) as { ok?: boolean }) : first;
    assert.equal(props?.ok, true);

    await sql.query(
      `insert into audit_events (id, tenant_id, seq, actor, action, target, detail, prev_hash, hash)
       select 'aud_cap_' || g::text, 'ten_a', g, 'ada', 'tick', 'target', 'detail', 'prev', 'secret-hash-' || g::text
       from generate_series(1, 201) as g`,
    );
    await sql.query(
      `insert into audit_events (id, tenant_id, seq, actor, action, target, detail, prev_hash, hash)
       values ('aud_b', 'ten_b', 1, 'ben', 'tick', 'other', null, 'prev', 'secret-hash-b')`,
    );
    const recent = await recentAudit(sql, "ten_a", 10_000);
    assert.equal(recent.length, 200);
    assert.equal(recent[0]?.seq, 201);
    assert.equal(recent[0]?.actor, "ada");
    assert.equal(recent[0]?.action, "tick");
    assert.equal(recent[0]?.target, "target");
    assert.equal(recent[0]?.detail, "detail");
    assert.equal(Object.hasOwn(recent[0] ?? {}, "hash"), false);
    assert.equal(Object.hasOwn(recent[0] ?? {}, "prev_hash"), false);
    assert.equal(JSON.stringify(recent).includes("secret-hash"), false);
    const other = await recentAudit(sql, "ten_b", 10);
    assert.equal(other.length, 1);
    assert.equal(other[0]?.actor, "ben");
    assert.equal(other[0]?.detail, null);
    assert.deepEqual(await recentAudit(sql, "ten_a", 0), []);
    assert.deepEqual(await recentAudit(sql, "ten_a", -5), []);
  } finally {
    await pg.close();
  }
});

test("health counts do not leak across tenants", async () => {
  const { pg, sql } = await db();
  try {
    await createDirectoryUser(sql, "ten_a", { email: "a1@example.com", name: "A1", passwordHash: "h", role: "owner" });
    await createDirectoryUser(sql, "ten_a", { email: "a2@example.com", name: "A2", passwordHash: "h", role: "member" });
    await createDirectoryUser(sql, "ten_b", { email: "b1@example.com", name: "B1", passwordHash: "h", role: "owner" });
    await sql.query("insert into workspaces (id, tenant_id, name) values ('ws_a', 'ten_a', 'A'), ('ws_b', 'ten_b', 'B')");
    await sql.query(
      `insert into forms (id, tenant_id, workspace_id, name, title, display, status, version, schema, settings, created_at, updated_at)
       values
         ('frm_a', 'ten_a', 'ws_a', 'intake', 'Intake', 'form', 'draft', 1, '{}'::jsonb, '{}'::jsonb, now(), now()),
         ('frm_b1', 'ten_b', 'ws_b', 'one', 'One', 'form', 'draft', 1, '{}'::jsonb, '{}'::jsonb, now(), now()),
         ('frm_b2', 'ten_b', 'ws_b', 'two', 'Two', 'form', 'draft', 1, '{}'::jsonb, '{}'::jsonb, now(), now())`,
    );
    await sql.query(
      `insert into submissions (id, tenant_id, workspace_id, form_id, form_name, form_version, status, data, created_at, updated_at)
       values ('sub_a', 'ten_a', 'ws_a', 'frm_a', 'intake', 1, 'submitted', '{}'::jsonb, now(), now())`,
    );
    await sql.query(
      `insert into jobs (id, tenant_id, queue, status, payload) values
         ('job_a', 'ten_a', 'mail', 'queued', '{}'::jsonb),
         ('job_b1', 'ten_b', 'mail', 'queued', '{}'::jsonb),
         ('job_b2', 'ten_b', 'mail', 'queued', '{}'::jsonb)`,
    );
    await sql.query(
      `insert into workflow_tasks (id, tenant_id, submission_id, node_id, status) values
         ('task_a_open', 'ten_a', 'sub_a', 'review', 'open'),
         ('task_a_done', 'ten_a', 'sub_a', 'review', 'done'),
         ('task_b_open', 'ten_b', 'sub_b', 'review', 'open'),
         ('task_b_claimed', 'ten_b', 'sub_b', 'review', 'claimed')`,
    );
    const a = await healthCounts(sql, "ten_a");
    const b = await healthCounts(sql, "ten_b");
    const empty = await healthCounts(sql, "ten_empty");
    assert.deepEqual(a, { users: 2, forms: 1, submissions: 1, jobs: 1, openTasks: 1 });
    assert.deepEqual(b, { users: 1, forms: 2, submissions: 0, jobs: 2, openTasks: 1 });
    assert.deepEqual(empty, { users: 0, forms: 0, submissions: 0, jobs: 0, openTasks: 0 });
  } finally {
    await pg.close();
  }
});
