import type { Queryable } from "../platform/durable.ts";
import type { RunState, RunStatus } from "./runtime.ts";

export interface NodeRunRow {
  id: string;
  tenantId: string;
  submissionId: string;
  nodeId: string;
  status: string;
  attempts: number;
  lastError: string | null;
}

const TERMINAL: RunStatus[] = ["COMPLETED", "CANCELLED", "DEAD_LETTER"];

/** Project interpreter state onto workflow_node_runs rows. One row per node that has been touched. */
export function projectNodeRuns(state: RunState, tenantId: string, submissionId: string): NodeRunRow[] {
  const seen = new Set<string>();
  const rows: NodeRunRow[] = [];
  const push = (nodeId: string, status: string, error: string | null) => {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    rows.push({
      id: `wnr_${submissionId}_${nodeId}`,
      tenantId,
      submissionId,
      nodeId,
      status,
      attempts: state.attempts[nodeId] ?? 0,
      lastError: error,
    });
  };
  for (const token of state.tokens) {
    const status = token.status === "waiting" ? "WAITING" : token.status === "active" ? "RUNNING" : "done";
    push(token.nodeId, status, null);
  }
  for (const task of state.tasks) {
    const status = task.status === "done" ? "COMPLETED" : task.status === "cancelled" ? "CANCELLED" : "WAITING";
    push(task.nodeId, status, null);
  }
  for (const [nodeId, output] of Object.entries(state.outputs)) {
    push(nodeId, "COMPLETED", null);
    void output;
  }
  const lastError = [...state.log].reverse().find((event) => event.action === "retry" || event.action === "dead");
  if (lastError?.nodeId) push(lastError.nodeId, state.status === "DEAD_LETTER" ? "DEAD_LETTER" : "RETRYING", lastError.detail ?? null);
  if (TERMINAL.includes(state.status)) {
    for (const row of rows) {
      if (row.status === "RUNNING" || row.status === "WAITING") row.status = state.status;
    }
  }
  return rows;
}

export async function upsertNodeRuns(db: Queryable, rows: NodeRunRow[]): Promise<void> {
  for (const row of rows) {
    await db.query(
      `insert into workflow_node_runs (id, tenant_id, submission_id, node_id, status, attempts, last_error, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (id) do update set status = excluded.status, attempts = excluded.attempts, last_error = excluded.last_error, updated_at = now()`,
      [row.id, row.tenantId, row.submissionId, row.nodeId, row.status, row.attempts, row.lastError],
    );
  }
}

export async function readNodeRuns(db: Queryable, tenantId: string, submissionId: string): Promise<NodeRunRow[]> {
  const rows = await db.query<{ id: string; tenant_id: string; submission_id: string; node_id: string; status: string; attempts: number; last_error: string | null }>(
    `select id, tenant_id, submission_id, node_id, status, attempts, last_error
     from workflow_node_runs where tenant_id = $1 and submission_id = $2 order by node_id`,
    [tenantId, submissionId],
  );
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    submissionId: row.submission_id,
    nodeId: row.node_id,
    status: row.status,
    attempts: Number(row.attempts),
    lastError: row.last_error,
  }));
}

/**
 * A restarted worker must not open a second token for a node that already completed.
 * Returns node ids that are safe to enter.
 */
export function nodesSafeToEnter(state: RunState, persisted: NodeRunRow[]): string[] {
  const done = new Set(persisted.filter((row) => row.status === "COMPLETED" || row.status === "done").map((row) => row.nodeId));
  return state.tokens.filter((token) => token.status === "active" && !done.has(token.nodeId)).map((token) => token.nodeId);
}
