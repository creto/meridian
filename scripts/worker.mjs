#!/usr/bin/env node
/**
 * Background worker.
 * With DATABASE_URL it claims due rows from jobs and records the outcome.
 * Without DATABASE_URL it stays idle. The preview web process pumps its own
 * in-memory export and notification queue; this process does not share that memory.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const pollMs = Number(process.env.MERIDIAN_WORKER_POLL_MS ?? 2000);

function log(message) {
  console.log(`[worker] ${new Date().toISOString()} ${message}`);
}

async function claim(client) {
  const result = await client.query(
    `with next as (
       select id from jobs
       where status in ('queued', 'retry') and run_at <= now()
       order by run_at
       for update skip locked
       limit 1
     )
     update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
     from next where jobs.id = next.id
     returning jobs.id, jobs.tenant_id, jobs.queue, jobs.attempts, jobs.max_attempts`,
  );
  return result.rows[0] ?? null;
}

async function finish(client, job, error) {
  if (!error) {
    await client.query("update jobs set status = 'completed', last_error = null, updated_at = now() where id = $1", [job.id]);
    return;
  }
  const dead = job.attempts >= job.max_attempts;
  await client.query(
    "update jobs set status = $2, last_error = $3, updated_at = now(), run_at = now() + interval '1 minute' where id = $1",
    [job.id, dead ? "dead" : "retry", error],
  );
}

async function handle(job) {
  if (job.queue === "export" || job.queue === "notification" || job.queue === "pdf") return;
  throw new Error(`No worker handler for ${job.queue}`);
}

async function loop() {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  for (;;) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const job = await claim(client);
      if (!job) {
        await client.query("commit");
      } else {
        try {
          await handle(job);
          await finish(client, job, null);
          await client.query("commit");
          log(`completed ${job.id} ${job.queue}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "failed";
          await finish(client, job, message);
          await client.query("commit");
          log(`failed ${job.id} ${message}`);
        }
      }
    } catch (error) {
      try { await client.query("rollback"); } catch { /* connection already lost */ }
      log(error instanceof Error ? error.message : "poll failed");
    } finally {
      client.release();
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

if (!databaseUrl) {
  log("idle: DATABASE_URL is not set. Preview jobs run inside the web process.");
  setInterval(() => log("idle"), 60_000);
} else {
  loop().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
