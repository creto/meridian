import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

export type ReviewState = "draft" | "in_review" | "changes_requested" | "approved";

const EDGES: Record<ReviewState, ReviewState[]> = {
  draft: ["in_review"],
  in_review: ["approved", "changes_requested"],
  changes_requested: ["in_review"],
  approved: ["draft"],
};

export function transitionReview(from: ReviewState, to: ReviewState): { ok: true } | { ok: false; code: "ILLEGAL" } {
  if (!EDGES[from].includes(to)) return { ok: false, code: "ILLEGAL" };
  return { ok: true };
}

export function saveEdit<T>(input: { baseRevision: number; currentRevision: number; next: T }): { ok: true; revision: number; value: T } | { ok: false; code: "STALE" } {
  if (input.baseRevision !== input.currentRevision) return { ok: false, code: "STALE" };
  return { ok: true, revision: input.currentRevision + 1, value: input.next };
}

export interface EditLock {
  holderId: string;
  revision: number;
  expiresAt: number;
}

export function acquireLock(current: EditLock | null, holderId: string, revision: number, now: number, ttlMs: number): { ok: true; lock: EditLock } | { ok: false; code: "LOCKED" } {
  if (current && current.expiresAt > now && current.holderId !== holderId) return { ok: false, code: "LOCKED" };
  return { ok: true, lock: { holderId, revision, expiresAt: now + ttlMs } };
}

export function renewLock(current: EditLock | null, holderId: string, now: number, ttlMs: number): { ok: true; lock: EditLock } | { ok: false; code: "LOCKED" | "MISSING" } {
  if (!current) return { ok: false, code: "MISSING" };
  if (current.holderId !== holderId && current.expiresAt > now) return { ok: false, code: "LOCKED" };
  return { ok: true, lock: { ...current, holderId, expiresAt: now + ttlMs } };
}

export function releaseLock(current: EditLock | null, holderId: string): EditLock | null {
  if (!current || current.holderId !== holderId) return current;
  return null;
}

export type CommentTarget = "form" | "submission" | "task";

export interface Comment {
  id: string;
  targetType: CommentTarget;
  targetId: string;
  authorId: string;
  body: string;
}

export function addComment(input: { targetType: CommentTarget; targetId: string; authorId: string; body: string }): Comment | { ok: false; code: "EMPTY" | "TOO_LONG" } {
  const body = input.body.trim();
  if (!body) return { ok: false, code: "EMPTY" };
  if (body.length > 4000) return { ok: false, code: "TOO_LONG" };
  return { id: `cmt_${randomBytes(6).toString("hex")}`, targetType: input.targetType, targetId: input.targetId, authorId: input.authorId, body };
}

export async function insertComment(db: Queryable, tenantId: string, comment: Comment): Promise<void> {
  await db.query(
    `insert into comments (id, tenant_id, target_type, target_id, author_id, body) values ($1,$2,$3,$4,$5,$6)`,
    [comment.id, tenantId, comment.targetType, comment.targetId, comment.authorId, comment.body],
  );
}

export async function saveLock(db: Queryable, tenantId: string, formId: string, lock: EditLock): Promise<void> {
  await db.query(
    `insert into form_edit_locks (tenant_id, form_id, holder_id, revision, expires_at)
     values ($1,$2,$3,$4,$5)
     on conflict (tenant_id, form_id) do update set holder_id = excluded.holder_id, revision = excluded.revision, expires_at = excluded.expires_at`,
    [tenantId, formId, lock.holderId, lock.revision, new Date(lock.expiresAt).toISOString()],
  );
}
