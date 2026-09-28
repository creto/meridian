import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { planRetention, purgeSubmissionData, type Queryable } from "./jobs.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
  };
}

async function freshDb(): Promise<{ db: Queryable; pg: PGlite }> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-retention-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  return { db: wrap(pg), pg };
}

async function seedTenant(db: Queryable, tenantId: string, workspaceId: string): Promise<void> {
  await db.query("insert into tenants (id, name) values ($1, $2)", [tenantId, tenantId]);
  await db.query("insert into workspaces (id, tenant_id, name) values ($1, $2, $3)", [workspaceId, tenantId, tenantId]);
}

async function seedSubmission(
  db: Queryable,
  input: { id: string; tenantId: string; workspaceId: string; createdAt: string; data: Record<string, string> },
): Promise<void> {
  await db.query(
    `insert into submissions (id, tenant_id, workspace_id, form_id, form_name, form_version, status, data, created_at, updated_at)
     values ($1, $2, $3, 'frm_x', 'intake', 1, 'submitted', $4::jsonb, $5, $5)`,
    [input.id, input.tenantId, input.workspaceId, JSON.stringify(input.data), input.createdAt],
  );
}

function payload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
}

test("retention purges only the caller's expired rows and keeps audit", async () => {
  const { db, pg } = await freshDb();
  const now = new Date("2026-09-28T00:00:00.000Z");
  await seedTenant(db, "ten_a", "ws_x");
  await seedTenant(db, "ten_b", "ws_y");
  await db.query(
    "insert into tenant_settings (tenant_id, retention, retention_days, legal_hold) values ($1, 'days', 30, false), ($2, 'days', 30, false)",
    ["ten_a", "ten_b"],
  );
  await seedSubmission(db, {
    id: "sub_old",
    tenantId: "ten_a",
    workspaceId: "ws_x",
    createdAt: "2020-01-01T00:00:00.000Z",
    data: { secret: "a-old" },
  });
  await seedSubmission(db, {
    id: "sub_new",
    tenantId: "ten_a",
    workspaceId: "ws_x",
    createdAt: "2026-09-20T00:00:00.000Z",
    data: { secret: "a-new" },
  });
  await seedSubmission(db, {
    id: "sub_b",
    tenantId: "ten_b",
    workspaceId: "ws_y",
    createdAt: "2020-01-01T00:00:00.000Z",
    data: { secret: "b-keep" },
  });
  await db.query(
    "insert into audit_events (id, tenant_id, seq, actor, action, target, prev_hash, hash) values ('aud_1', 'ten_a', 1, 'system', 'submission.create', 'sub_old', '0', 'abc')",
  );

  const plan = await planRetention(db, "ten_a", now);
  assert.deepEqual(plan.deletableSubmissionIds, ["sub_old"]);
  assert.equal(plan.held, 0);
  assert.equal(plan.forever, 0);
  const other = await planRetention(db, "ten_b", now);
  assert.deepEqual(other.deletableSubmissionIds, ["sub_b"]);

  const wiped = await purgeSubmissionData(db, "ten_a", ["sub_old", "sub_b", "sub_missing"]);
  assert.equal(wiped, 1);
  const rows = await db.query<{ id: string; tenant_id: string; status: string; data: unknown }>(
    "select id, tenant_id, status, data from submissions order by id",
  );
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId.sub_old?.status, "deleted");
  assert.deepEqual(payload(byId.sub_old?.data), {});
  assert.equal(byId.sub_new?.status, "submitted");
  assert.equal(payload(byId.sub_new?.data).secret, "a-new");
  assert.equal(byId.sub_b?.tenant_id, "ten_b");
  assert.equal(byId.sub_b?.status, "submitted");
  assert.equal(payload(byId.sub_b?.data).secret, "b-keep");
  const audit = await db.query("select id from audit_events where tenant_id = $1", ["ten_a"]);
  assert.equal(audit.length, 1);
  assert.equal(await purgeSubmissionData(db, "ten_a", []), 0);
  await pg.close();
});

test("legal hold blocks planning and purge, and missing settings is forever", async () => {
  const { db, pg } = await freshDb();
  const now = new Date("2026-09-28T00:00:00.000Z");
  await seedTenant(db, "ten_hold", "ws_x");
  await seedTenant(db, "ten_forever", "ws_y");
  await db.query(
    "insert into tenant_settings (tenant_id, retention, retention_days, legal_hold) values ($1, 'days', 1, true)",
    ["ten_hold"],
  );
  await seedSubmission(db, {
    id: "sub_hold",
    tenantId: "ten_hold",
    workspaceId: "ws_x",
    createdAt: "2020-01-01T00:00:00.000Z",
    data: { secret: "held" },
  });
  await seedSubmission(db, {
    id: "sub_forever",
    tenantId: "ten_forever",
    workspaceId: "ws_y",
    createdAt: "2020-01-01T00:00:00.000Z",
    data: { secret: "keep" },
  });

  const held = await planRetention(db, "ten_hold", now);
  assert.deepEqual(held.deletableSubmissionIds, []);
  assert.equal(held.held, 1);
  assert.equal(held.forever, 0);
  assert.equal(await purgeSubmissionData(db, "ten_hold", ["sub_hold"]), 0);
  const still = await db.query<{ status: string; data: unknown }>("select status, data from submissions where id = $1", ["sub_hold"]);
  assert.equal(still[0]?.status, "submitted");
  assert.equal(payload(still[0]?.data).secret, "held");

  const forever = await planRetention(db, "ten_forever", now);
  assert.deepEqual(forever.deletableSubmissionIds, []);
  assert.equal(forever.held, 0);
  assert.equal(forever.forever, 1);
  await pg.close();
});
