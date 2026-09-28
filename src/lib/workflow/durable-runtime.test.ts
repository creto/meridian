import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../platform/durable.ts";
import {
  arriveBranch,
  claimTask,
  completeTask,
  joinGate,
  openTask,
  openToken,
  recordServiceAttempt,
  serviceBackoff,
  splitBranches,
} from "./durable-runtime.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
}

async function freshDb(): Promise<{ pg: PGlite; db: Queryable }> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-wf-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  await pg.exec(readFileSync(new URL("../../../migrations/0001_meridian_platform.sql", import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../../../migrations/0002_domain.sql", import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../../../migrations/0003_enterprise.sql", import.meta.url), "utf8"));
  const db = wrap(pg);
  await db.query("insert into tenants (id, name) values ('ten_a', 'A'), ('ten_b', 'B')");
  return { pg, db };
}

test("another tenant cannot claim or complete a task, and a second complete is already done", async () => {
  const { pg, db } = await freshDb();
  try {
    const first = await openToken(db, "ten_a", { submissionId: "sub_1", nodeId: "review", branchId: "main" });
    const again = await openToken(db, "ten_a", { submissionId: "sub_1", nodeId: "review", branchId: "main" });
    assert.equal(again.id, first.id);
    const other = await openToken(db, "ten_b", { submissionId: "sub_1", nodeId: "review", branchId: "main" });
    assert.notEqual(other.id, first.id);

    const task = await openTask(db, "ten_a", {
      submissionId: "sub_1",
      nodeId: "review",
      assignedRole: "Reviewer",
      dueAt: "2026-10-01T00:00:00.000Z",
    });
    const foreignClaim = await claimTask(db, "ten_b", task.id, "usr_b");
    assert.equal(foreignClaim.ok, false);
    if (!foreignClaim.ok) assert.equal(foreignClaim.code, "NOT_FOUND");
    const foreignDone = await completeTask(db, "ten_b", {
      taskId: task.id,
      actor: "usr_b",
      decision: "approve",
      comment: "stolen",
    });
    assert.equal(foreignDone.ok, false);
    if (!foreignDone.ok) assert.equal(foreignDone.code, "NOT_FOUND");

    const claimed = await claimTask(db, "ten_a", task.id, "usr_a");
    assert.deepEqual(claimed, { ok: true });
    const done = await completeTask(db, "ten_a", {
      taskId: task.id,
      actor: "usr_a",
      decision: "approve",
      comment: "secret-note",
    });
    assert.equal(done.ok, true);
    if (done.ok) assert.equal(done.eventSeq, 1);
    const twice = await completeTask(db, "ten_a", { taskId: task.id, actor: "usr_a", decision: "reject" });
    assert.equal(twice.ok, false);
    if (!twice.ok) assert.equal(twice.code, "ALREADY_DONE");

    const row = await db.query<{ status: string; decision: string; comment: string; claimed_by: string }>(
      "select status, decision, comment, claimed_by from workflow_tasks where id = $1 and tenant_id = $2",
      [task.id, "ten_a"],
    );
    assert.equal(row[0]?.status, "completed");
    assert.equal(row[0]?.decision, "approve");
    assert.equal(row[0]?.comment, "secret-note");
    assert.equal(row[0]?.claimed_by, "usr_a");
    const hidden = await db.query("select id from workflow_tasks where tenant_id = $1", ["ten_b"]);
    assert.equal(hidden.length, 0);

    const events = await db.query<{ seq: number; event: string }>(
      "select seq, event from workflow_events where tenant_id = $1 and submission_id = $2 order by seq",
      ["ten_a", "sub_1"],
    );
    assert.equal(events.length, 1);
    assert.equal(Number(events[0]?.seq), 1);
    assert.equal(events[0]?.event, "task.completed");
    const outbox = await db.query<{ topic: string; payload: { decision?: string; comment?: string } | string }>(
      "select topic, payload from outbox_events where tenant_id = $1",
      ["ten_a"],
    );
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.topic, "workflow.task.completed");
    const payload = typeof outbox[0]?.payload === "string" ? JSON.parse(outbox[0].payload) as { decision?: string; comment?: string } : outbox[0]?.payload;
    assert.equal(payload?.decision, "approve");
    assert.equal(payload?.comment, undefined);
    const audit = await db.query<{ action: string; target: string; detail: string | null }>(
      "select action, target, detail from audit_events where tenant_id = $1",
      ["ten_a"],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.action, "workflow.task.complete");
    assert.equal(audit[0]?.target, task.id);
    assert.equal(audit[0]?.detail, "approve");
    assert.equal(String(audit[0]?.detail).includes("secret-note"), false);
    const leakedAudit = await db.query("select id from audit_events where tenant_id = $1", ["ten_b"]);
    assert.equal(leakedAudit.length, 0);
    const leakedEvents = await db.query("select id from workflow_events where tenant_id = $1", ["ten_b"]);
    assert.equal(leakedEvents.length, 0);
  } finally {
    await pg.close();
  }
});

test("split of three branches is ready for ANY and N of M at two arrivals, not for ALL", async () => {
  const { pg, db } = await freshDb();
  try {
    const split = await splitBranches(db, "ten_a", "sub_join", "split", ["b1", "b2", "b3"]);
    assert.equal(split.tokenIds.length, 3);
    assert.equal(new Set(split.tokenIds).size, 3);
    await arriveBranch(db, "ten_a", split.tokenIds[0]!);
    await arriveBranch(db, "ten_a", split.tokenIds[1]!);
    await arriveBranch(db, "ten_b", split.tokenIds[2]!);

    const statuses = await db.query<{ id: string; status: string }>(
      "select id, status from workflow_tokens where tenant_id = $1 and submission_id = $2 order by branch_id",
      ["ten_a", "sub_join"],
    );
    assert.deepEqual(
      statuses.map((row) => row.status),
      ["arrived", "arrived", "active"],
    );

    const all = await joinGate(db, "ten_a", "sub_join", ["b1", "b2", "b3"], "ALL");
    assert.equal(all.ready, false);
    assert.equal(all.arrived, 2);
    assert.equal(all.required, 3);
    const any = await joinGate(db, "ten_a", "sub_join", ["b1", "b2", "b3"], "ANY");
    assert.equal(any.ready, true);
    assert.equal(any.arrived, 2);
    assert.equal(any.required, 1);
    const nOfM = await joinGate(db, "ten_a", "sub_join", ["b1", "b2", "b3"], "N_OF_M", 2);
    assert.equal(nOfM.ready, true);
    assert.equal(nOfM.arrived, 2);
    assert.equal(nOfM.required, 2);

    const foreign = await joinGate(db, "ten_b", "sub_join", ["b1", "b2", "b3"], "ANY");
    assert.equal(foreign.arrived, 0);
    assert.equal(foreign.ready, false);
  } finally {
    await pg.close();
  }
});

test("RETRY enqueues a workflow job and the seventh failure dead-letters only that tenant", async () => {
  const { pg, db } = await freshDb();
  try {
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map((attempt) => serviceBackoff(attempt)),
      [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000, -1, -1],
    );

    const retry = await recordServiceAttempt(db, "ten_a", {
      submissionId: "sub_svc",
      nodeId: "notify",
      state: "RETRY",
      attempt: 0,
      error: "timeout",
    });
    assert.equal(retry.next, "retry");
    const jobs = await db.query<{ queue: string; status: string; delta_ms: number | string }>(
      `select queue, status, extract(epoch from (run_at - now())) * 1000 as delta_ms
       from jobs where tenant_id = $1`,
      ["ten_a"],
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.queue, "workflow");
    assert.equal(jobs[0]?.status, "queued");
    const delta = Number(jobs[0]?.delta_ms);
    assert.ok(delta > 50_000 && delta <= 60_000);

    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const result = await recordServiceAttempt(db, "ten_a", {
        submissionId: "sub_svc",
        nodeId: "notify",
        state: "FAIL",
        attempt,
        error: "down",
      });
      outcomes.push(result.next);
    }
    assert.deepEqual(outcomes, ["retry", "retry", "retry", "retry", "retry", "retry", "dead"]);

    const mine = await db.query<{ tenant_id: string; source: string; reason: string }>(
      "select tenant_id, source, reason from dead_letter_events where tenant_id = $1",
      ["ten_a"],
    );
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.tenant_id, "ten_a");
    assert.equal(mine[0]?.source, "workflow");
    assert.equal(mine[0]?.reason, "down");
    const theirs = await db.query("select id from dead_letter_events where tenant_id = $1", ["ten_b"]);
    assert.equal(theirs.length, 0);
    const stillOneJob = await db.query("select id from jobs where tenant_id = $1", ["ten_a"]);
    assert.equal(stillOneJob.length, 1);

    const continued = await recordServiceAttempt(db, "ten_a", {
      submissionId: "sub_svc",
      nodeId: "notify",
      state: "SUCCESS",
      attempt: 1,
    });
    assert.equal(continued.next, "continue");
    const waiting = await recordServiceAttempt(db, "ten_b", {
      submissionId: "sub_other",
      nodeId: "timer",
      state: "WAIT",
      attempt: 3,
    });
    assert.equal(waiting.next, "retry");
    const jobsB = await db.query("select id from jobs where tenant_id = $1", ["ten_b"]);
    assert.equal(jobsB.length, 0);
    const deadB = await db.query("select id from dead_letter_events where tenant_id = $1", ["ten_b"]);
    assert.equal(deadB.length, 0);
  } finally {
    await pg.close();
  }
});
