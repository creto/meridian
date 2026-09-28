import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000];

export interface ClaimedJob {
  id: string;
  tenant_id: string;
  queue: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

export type JobHandler = (job: ClaimedJob, db: Queryable) => Promise<void>;

export async function claimNextJob(db: Queryable, queues?: string[]): Promise<ClaimedJob | null> {
  const filter = queues?.length ? "and queue = any($1::text[])" : "";
  const params = queues?.length ? [queues] : [];
  const rows = await db.query<ClaimedJob>(
    `with next as (
       select id from jobs
       where status in ('queued', 'retry') and run_at <= now() ${filter}
       order by run_at
       for update skip locked
       limit 1
     )
     update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
     from next where jobs.id = next.id
     returning jobs.id, jobs.tenant_id, jobs.queue, jobs.payload, jobs.attempts, jobs.max_attempts`,
    params,
  );
  return rows[0] ?? null;
}

async function event(db: Queryable, tenantId: string, jobId: string, name: string, detail?: string) {
  await db.query(
    "insert into job_events (id, tenant_id, job_id, event, detail) values ($1,$2,$3,$4,$5)",
    [`jev_${randomBytes(6).toString("hex")}`, tenantId, jobId, name, detail ?? null],
  );
}

export async function runClaimedJob(db: Queryable, job: ClaimedJob, handlers: Record<string, JobHandler>): Promise<"completed" | "retry" | "dead"> {
  const handler = handlers[job.queue];
  try {
    if (!handler) throw new Error(`No handler for queue ${job.queue}`);
    await handler(job, db);
    await db.query("update jobs set status = 'completed', last_error = null, updated_at = now() where id = $1 and tenant_id = $2", [job.id, job.tenant_id]);
    await event(db, job.tenant_id, job.id, "completed");
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    const dead = job.attempts >= job.max_attempts;
    if (dead) {
      await db.query("update jobs set status = 'dead', last_error = $3, updated_at = now() where id = $1 and tenant_id = $2", [job.id, job.tenant_id, message]);
      await db.query(
        "insert into dead_letter_events (id, tenant_id, source, payload, reason) values ($1,$2,'job',$3::jsonb,$4)",
        [`dead_${job.id}`, job.tenant_id, JSON.stringify({ jobId: job.id, queue: job.queue }), message],
      );
      await event(db, job.tenant_id, job.id, "dead", message);
      return "dead";
    }
    const delay = BACKOFF_MS[Math.max(0, job.attempts - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
    await db.query(
      `update jobs set status = 'retry', last_error = $3, updated_at = now(), run_at = now() + ($4 || ' milliseconds')::interval
       where id = $1 and tenant_id = $2`,
      [job.id, job.tenant_id, message, String(delay)],
    );
    await event(db, job.tenant_id, job.id, "retry", message);
    return "retry";
  }
}

export async function dispatchAvailable(db: Queryable, handlers: Record<string, JobHandler>, limit = 10): Promise<number> {
  let ran = 0;
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextJob(db);
    if (!job) break;
    await runClaimedJob(db, job, handlers);
    ran += 1;
  }
  return ran;
}
