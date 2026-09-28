import type { FormDefinition, IdempotencyRecord, Submission } from "../forms/types.ts";

export interface WorkspaceSnapshot {
  revision: number;
  forms: FormDefinition[];
  submissions: Submission[];
  idempotency: IdempotencyRecord[];
}

let snap: WorkspaceSnapshot = { revision: 0, forms: [], submissions: [], idempotency: [] };

export function readSnapshot(): WorkspaceSnapshot {
  return snap;
}

export function writeSnapshot(next: WorkspaceSnapshot) {
  if (next.revision < snap.revision) return snap;
  snap = next;
  return snap;
}

export function mutateSnapshot(recipe: (current: WorkspaceSnapshot) => WorkspaceSnapshot) {
  snap = recipe(snap);
  return snap;
}
