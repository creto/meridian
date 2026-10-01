import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../platform/durable.ts";
import { pumpJobs } from "./worker-loop.ts";

function wrap(pg: PGlite): Queryable {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

async function db(): Promise<Queryable> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-pump-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  const root = new URL("../../../migrations/", import.meta.url);
  for (const name of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql", "0004_closure.sql"]) {
    await pg.exec(readFileSync(new URL(name, root), "utf8"));
  }
  const sql = wrap(pg);
  await sql.query("insert into tenants (id, name) values ('ten_northwind', 'Northwind'), ('ten_contoso', 'Contoso')");
  return sql;
}

test("a due timer fires for its tenant and mail waits for SMTP", async () => {
  const sql = await db();
  await sql.query(
    "insert into jobs (id, tenant_id, queue, status, payload) values ('job_timer', 'ten_northwind', 'timer', 'queued', $1::jsonb)",
    [JSON.stringify({ submissionId: "sub_1", nodeId: "wait" })],
  );
  await sql.query(
    "insert into jobs (id, tenant_id, queue, status, payload, run_at) values ('job_mail', 'ten_contoso', 'notification', 'queued', '{}'::jsonb, now() + interval '1 hour')",
  );
  await sql.query(
    "insert into outbox_events (id, tenant_id, topic, payload) values ('out_1', 'ten_northwind', 'form.published', '{}'::jsonb)",
  );
  const first = await pumpJobs(sql, {} as NodeJS.ProcessEnv);
  assert.equal(first.jobs, 1);
  const events = await sql.query<{ event: string }>("select event from workflow_events where tenant_id = $1 and submission_id = $2", ["ten_northwind", "sub_1"]);
  assert.equal(events[0]?.event, "timer");
  const published = await sql.query<{ published_at: string | null }>("select published_at from outbox_events where id = 'out_1' and tenant_id = 'ten_northwind'");
  assert.ok(published[0]?.published_at);
  const other = await sql.query<{ status: string }>("select status from jobs where id = 'job_mail' and tenant_id = 'ten_contoso'");
  assert.equal(other[0]?.status, "queued");
  await sql.query("update jobs set run_at = now() where id = 'job_mail'");
  const second = await pumpJobs(sql, {} as NodeJS.ProcessEnv);
  assert.equal(second.failed, 1);
  const mail = await sql.query<{ status: string; last_error: string }>("select status, last_error from jobs where id = 'job_mail' and tenant_id = 'ten_contoso'");
  assert.equal(mail[0]?.status, "retry");
  assert.match(mail[0]?.last_error ?? "", /SMTP_URL/);
  const missed = await sql.query("update jobs set status = 'completed' where id = 'job_mail' and tenant_id = 'ten_northwind' returning id");
  assert.equal(missed.length, 0);
});
