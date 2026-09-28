import { randomBytes } from "node:crypto";
import { appendAudit, type Queryable } from "../platform/durable.ts";

/** Zero-based service attempt. Indexes 0..5 are delays; 6 and above are exhausted. */
const SERVICE_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000] as const;

export type ServiceState = "SUCCESS" | "RETRY" | "FAIL" | "WAIT";
export type JoinPolicy = "ALL" | "ANY" | "N_OF_M";

export type TaskFailureCode = "NOT_FOUND" | "NOT_OPEN" | "ALREADY_DONE";

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/**
 * Milliseconds before the next service attempt.
 * Attempt 0 is the first retry (60s). Attempt >= 6 returns -1 (schedule exhausted).
 */
export function serviceBackoff(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= SERVICE_BACKOFF_MS.length) return -1;
  return SERVICE_BACKOFF_MS[attempt]!;
}

export async function openToken(
  db: Queryable,
  tenantId: string,
  input: { submissionId: string; nodeId: string; branchId: string },
): Promise<{ id: string }> {
  const existing = await db.query<{ id: string }>(
    `select id from workflow_tokens
     where tenant_id = $1 and submission_id = $2 and node_id = $3 and branch_id = $4 and status = 'active'
     order by arrived_at asc
     limit 1`,
    [tenantId, input.submissionId, input.nodeId, input.branchId],
  );
  if (existing[0]) return { id: existing[0].id };
  const id = newId("tok");
  await db.query(
    `insert into workflow_tokens (id, tenant_id, submission_id, node_id, branch_id, status)
     values ($1, $2, $3, $4, $5, 'active')`,
    [id, tenantId, input.submissionId, input.nodeId, input.branchId],
  );
  return { id };
}

export async function openTask(
  db: Queryable,
  tenantId: string,
  input: { submissionId: string; nodeId: string; assignedRole?: string; dueAt?: string | Date },
): Promise<{ id: string }> {
  const id = newId("task");
  const dueAt = input.dueAt instanceof Date ? input.dueAt.toISOString() : (input.dueAt ?? null);
  await db.query(
    `insert into workflow_tasks (id, tenant_id, submission_id, node_id, assigned_role, status, due_at)
     values ($1, $2, $3, $4, $5, 'open', $6)`,
    [id, tenantId, input.submissionId, input.nodeId, input.assignedRole ?? null, dueAt],
  );
  return { id };
}

export async function claimTask(
  db: Queryable,
  tenantId: string,
  taskId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: TaskFailureCode }> {
  const claimed = await db.query<{ id: string }>(
    `update workflow_tasks
     set claimed_by = $3, status = 'claimed'
     where id = $1 and tenant_id = $2 and status = 'open'
     returning id`,
    [taskId, tenantId, userId],
  );
  if (claimed.length > 0) return { ok: true };
  const visible = await db.query<{ id: string }>(
    "select id from workflow_tasks where id = $1 and tenant_id = $2",
    [taskId, tenantId],
  );
  if (visible.length === 0) return { ok: false, code: "NOT_FOUND" };
  return { ok: false, code: "NOT_OPEN" };
}

/**
 * Complete one human task. The caller owns the transaction so FOR UPDATE
 * covers the update, the event, the outbox row, and the audit append.
 */
export async function completeTask(
  db: Queryable,
  tenantId: string,
  input: { taskId: string; actor: string; decision: "approve" | "reject" | "changes"; comment?: string },
): Promise<{ ok: true; eventSeq: number } | { ok: false; code: TaskFailureCode }> {
  const locked = await db.query<{ id: string; submission_id: string; node_id: string; status: string }>(
    `select id, submission_id, node_id, status
     from workflow_tasks
     where id = $1 and tenant_id = $2
     for update`,
    [input.taskId, tenantId],
  );
  const task = locked[0];
  if (!task) return { ok: false, code: "NOT_FOUND" };
  if (task.status === "completed") return { ok: false, code: "ALREADY_DONE" };

  const updated = await db.query<{ id: string }>(
    `update workflow_tasks
     set status = 'completed', decision = $3, comment = $4, completed_at = now()
     where id = $1 and tenant_id = $2 and status <> 'completed'
     returning id`,
    [input.taskId, tenantId, input.decision, input.comment ?? null],
  );
  if (updated.length === 0) return { ok: false, code: "ALREADY_DONE" };

  const seqRows = await db.query<{ seq: number | string }>(
    `select coalesce(max(seq), 0)::int as seq
     from workflow_events
     where tenant_id = $1 and submission_id = $2`,
    [tenantId, task.submission_id],
  );
  const eventSeq = Number(seqRows[0]?.seq ?? 0) + 1;
  await db.query(
    `insert into workflow_events (id, tenant_id, submission_id, seq, node_id, event, actor, detail)
     values ($1, $2, $3, $4, $5, 'task.completed', $6, $7)`,
    [newId("evt"), tenantId, task.submission_id, eventSeq, task.node_id, input.actor, input.decision],
  );
  await db.query(
    `insert into outbox_events (id, tenant_id, topic, payload)
     values ($1, $2, 'workflow.task.completed', $3::jsonb)`,
    [
      newId("out"),
      tenantId,
      JSON.stringify({
        taskId: input.taskId,
        submissionId: task.submission_id,
        nodeId: task.node_id,
        decision: input.decision,
        actor: input.actor,
        eventSeq,
      }),
    ],
  );
  await appendAudit(db, tenantId, {
    actor: input.actor,
    action: "workflow.task.complete",
    target: input.taskId,
    detail: input.decision,
  });
  return { ok: true, eventSeq };
}

export async function splitBranches(
  db: Queryable,
  tenantId: string,
  submissionId: string,
  nodeId: string,
  branchIds: string[],
): Promise<{ tokenIds: string[] }> {
  const tokenIds: string[] = [];
  for (const branchId of branchIds) {
    const token = await openToken(db, tenantId, { submissionId, nodeId, branchId });
    tokenIds.push(token.id);
  }
  return { tokenIds };
}

export async function arriveBranch(db: Queryable, tenantId: string, tokenId: string): Promise<void> {
  await db.query(
    `update workflow_tokens
     set status = 'arrived', completed_at = now()
     where id = $1 and tenant_id = $2`,
    [tokenId, tenantId],
  );
}

export async function joinGate(
  db: Queryable,
  tenantId: string,
  submissionId: string,
  branchIds: string[],
  policy: JoinPolicy,
  n?: number,
): Promise<{ ready: boolean; arrived: number; required: number }> {
  const rows = await db.query<{ arrived: number | string }>(
    `select count(*)::int as arrived
     from workflow_tokens
     where tenant_id = $1
       and submission_id = $2
       and branch_id = any($3::text[])
       and status in ('arrived', 'done')`,
    [tenantId, submissionId, branchIds],
  );
  const arrived = Number(rows[0]?.arrived ?? 0);
  const required = policy === "ALL" ? branchIds.length : policy === "ANY" ? 1 : (n ?? branchIds.length);
  const ready = policy === "ALL" ? arrived === branchIds.length : arrived >= required;
  return { ready, arrived, required };
}

export async function recordServiceAttempt(
  db: Queryable,
  tenantId: string,
  input: { submissionId: string; nodeId: string; state: ServiceState; attempt: number; error?: string },
): Promise<{ next: "continue" | "retry" | "dead" }> {
  if (input.state === "SUCCESS") return { next: "continue" };
  if (input.state === "WAIT") return { next: "retry" };

  const delay = serviceBackoff(input.attempt);
  if (input.state === "FAIL" && (input.attempt >= 6 || delay < 0)) {
    await db.query(
      `insert into dead_letter_events (id, tenant_id, source, payload, reason)
       values ($1, $2, 'workflow', $3::jsonb, $4)`,
      [
        newId("dead"),
        tenantId,
        JSON.stringify({
          submissionId: input.submissionId,
          nodeId: input.nodeId,
          attempt: input.attempt,
          state: input.state,
          error: input.error ?? null,
        }),
        input.error ?? "exhausted",
      ],
    );
    return { next: "dead" };
  }

  if (input.state === "RETRY") {
    await db.query(
      `insert into jobs (id, tenant_id, queue, status, payload, run_at)
       values ($1, $2, 'workflow', 'queued', $3::jsonb, now() + ($4 || ' milliseconds')::interval)`,
      [
        newId("job"),
        tenantId,
        JSON.stringify({
          submissionId: input.submissionId,
          nodeId: input.nodeId,
          state: input.state,
          attempt: input.attempt,
          error: input.error ?? null,
        }),
        String(delay < 0 ? 0 : delay),
      ],
    );
  }
  return { next: "retry" };
}
