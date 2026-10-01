import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { SPAN, Tracer, exportOtlp } from "../observe/otel.ts";
import { deliverDueWebhooks } from "../webhooks/pump.ts";
import { smtpRoundTrip } from "../connectors/roundtrip.ts";
import { advanceDueTimers } from "./timers.ts";

export interface ClaimedJob {
  id: string;
  tenant_id: string;
  queue: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

export interface PumpResult {
  jobs: number;
  failed: number;
  notices: number;
  timers: number;
  outbox: number;
  webhooks: { delivered: number; failed: number; blocked: number };
}

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function payloadOf(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function finishJob(db: Queryable, job: ClaimedJob, error: string | null): Promise<void> {
  if (!error) {
    await db.query("update jobs set status = 'completed', last_error = null, updated_at = now() where id = $1 and tenant_id = $2", [job.id, job.tenant_id]);
    return;
  }
  const dead = Number(job.attempts) >= Number(job.max_attempts);
  await db.query(
    "update jobs set status = $3, last_error = $4, updated_at = now(), run_at = now() + interval '1 minute' where id = $1 and tenant_id = $2",
    [job.id, job.tenant_id, dead ? "dead" : "retry", error],
  );
}

/** Run one claimed job. External connectors fail closed when their credentials are absent. */
export async function executeJob(db: Queryable, job: ClaimedJob, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const payload = payloadOf(job.payload);
  if (job.queue === "timer") {
    await db.query(
      "insert into job_events (id, tenant_id, job_id, event, detail) values ($1, $2, $3, 'timer.fired', $4)",
      [id("jev"), job.tenant_id, job.id, typeof payload.nodeId === "string" ? payload.nodeId : ""],
    );
    if (typeof payload.submissionId === "string" && payload.submissionId) {
      const seqRows = await db.query<{ seq: number }>(
        "select coalesce(max(seq), 0)::int as seq from workflow_events where tenant_id = $1 and submission_id = $2",
        [job.tenant_id, payload.submissionId],
      );
      const seq = Number(seqRows[0]?.seq ?? 0) + 1;
      await db.query(
        "insert into workflow_events (id, tenant_id, submission_id, seq, node_id, event, actor, detail) values ($1,$2,$3,$4,$5,'timer',$6,$7)",
        [id("evt"), job.tenant_id, payload.submissionId, seq, typeof payload.nodeId === "string" ? payload.nodeId : "timer", "worker", job.id],
      );
    }
    return;
  }
  if (job.queue === "notification" || job.queue === "email") {
    const sent = await smtpRoundTrip(env, { subject: typeof payload.subject === "string" ? payload.subject : "Meridian", body: typeof payload.body === "string" ? payload.body : "meridian" });
    if (!sent.ok) throw new Error(sent.message);
    return;
  }
  if (job.queue === "export" || job.queue === "pdf") {
    if (!env.S3_BUCKET?.trim() && payload.destination !== "database") throw new Error("No storage destination is configured for this job");
    await db.query(
      "insert into job_events (id, tenant_id, job_id, event, detail) values ($1, $2, $3, $4, $5)",
      [id("jev"), job.tenant_id, job.id, `${job.queue}.recorded`, typeof payload.key === "string" ? payload.key : ""],
    );
    return;
  }
  if (job.queue === "webhook") return;
  throw new Error(`No worker handler for ${job.queue}`);
}

async function pumpNotices(db: Queryable, env: NodeJS.ProcessEnv): Promise<number> {
  const rows = await db.query<{ id: string; tenant_id: string; attempts: number }>(
    "select id, tenant_id, attempts from notification_outbox where status in ('queued', 'retry') order by created_at limit 20",
  );
  if (!env.SMTP_URL?.trim()) {
    for (const row of rows) {
      const dead = row.attempts + 1 >= 5;
      await db.query(
        "update notification_outbox set status = $3, attempts = attempts + 1, last_error = $4 where id = $1 and tenant_id = $2",
        [row.id, row.tenant_id, dead ? "dead" : "retry", "SMTP_URL is not configured"],
      );
    }
    return 0;
  }
  const sent = await smtpRoundTrip(env);
  if (!sent.ok) {
    for (const row of rows) {
      await db.query(
        "update notification_outbox set status = 'retry', attempts = attempts + 1, last_error = $3 where id = $1 and tenant_id = $2",
        [row.id, row.tenant_id, sent.message],
      );
    }
    return 0;
  }
  for (const row of rows) {
    await db.query("update notification_outbox set status = 'sent', last_error = null where id = $1 and tenant_id = $2", [row.id, row.tenant_id]);
  }
  return rows.length;
}

async function drainOutbox(db: Queryable): Promise<number> {
  const rows = await db.query<{ id: string; tenant_id: string; topic: string }>(
    `with due as (
       select id from outbox_events
       where published_at is null
       order by created_at
       for update skip locked
       limit 20
     )
     update outbox_events set published_at = now()
     from due where outbox_events.id = due.id
     returning outbox_events.id, outbox_events.tenant_id, outbox_events.topic`,
  );
  for (const row of rows) {
    await db.query(
      "insert into job_events (id, tenant_id, job_id, event, detail) values ($1, $2, $3, 'outbox.published', $4)",
      [id("jev"), row.tenant_id, row.id, row.topic],
    );
  }
  return rows.length;
}

export async function pumpJobs(db: Queryable, env: NodeJS.ProcessEnv = process.env): Promise<PumpResult> {
  const claimed = await db.query<ClaimedJob>(
    `with next as (
       select id from jobs
       where status in ('queued', 'retry') and run_at <= now()
       order by run_at
       for update skip locked
       limit 1
     )
     update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
     from next where jobs.id = next.id
     returning jobs.id, jobs.tenant_id, jobs.queue, jobs.payload, jobs.attempts, jobs.max_attempts`,
  );
  let jobs = 0;
  let failed = 0;
  const job = claimed[0];
  if (job) {
    try {
      await executeJob(db, job, env);
      await finishJob(db, job, null);
      jobs += 1;
    } catch (error) {
      await finishJob(db, job, error instanceof Error ? error.message : "failed");
      failed += 1;
    }
  }
  const timers = await advanceDueTimers(db).catch(() => 0);
  const notices = await pumpNotices(db, env);
  const outbox = await drainOutbox(db).catch(() => 0);
  const webhooks = await deliverDueWebhooks(db, {
    resolveSecret: async () => null,
    fetchImpl: fetch,
  }).catch(() => ({ delivered: 0, failed: 0, blocked: 0 }));
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()) {
    const tracer = new Tracer();
    const span = tracer.startSpan(SPAN.jobExecute, { attributes: { jobs: String(jobs), outbox: String(outbox), timers: String(timers) } });
    tracer.end(span);
    await exportOtlp(tracer, fetch, env).catch(() => undefined);
  }
  return { jobs, failed, notices, webhooks, outbox, timers };
}

let started = false;

export function startJobPump(): void {
  if (started || process.env.MERIDIAN_DISABLE_PUMP === "1") return;
  started = true;
  const timer = setInterval(() => {
    void pumpOnce().catch((error) => {
      console.error("[pump]", error instanceof Error ? error.message : error);
    });
  }, Number(process.env.MERIDIAN_WORKER_POLL_MS ?? 2000));
  timer.unref?.();
}

export async function pumpOnce(): Promise<PumpResult> {
  const { getSql } = await import("../db.ts");
  const sql = await getSql();
  return pumpJobs(sql);
}

export async function runForever(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("[worker] idle: DATABASE_URL is not set. The web process pumps the embedded database.");
    setInterval(() => console.log("[worker] idle"), 60_000);
    return;
  }
  const wait = Number(process.env.MERIDIAN_WORKER_POLL_MS ?? 2000);
  for (;;) {
    try {
      const result = await pumpOnce();
      if (result.jobs || result.failed || result.notices) console.log(`[worker] ${JSON.stringify(result)}`);
    } catch (error) {
      console.error("[worker]", error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
