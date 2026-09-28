import { acquireLock, releaseLock, renewLock, saveEdit, transitionReview, type EditLock, type ReviewState } from "./review.ts";

export interface StudioHead {
  revision: number;
  review: ReviewState;
  lock: EditLock | null;
}

export type StudioSave<T> =
  | { ok: true; revision: number; value: T; review: ReviewState; lock: EditLock }
  | { ok: false; code: "STALE" | "LOCKED" | "REVIEW"; message: string };

const PUBLISH_FROM: ReviewState[] = ["approved"];

/**
 * Optimistic save used by the builder.
 * A save whose base revision is not the current revision is rejected.
 * A lock held by someone else is rejected. Review state is not changed here.
 */
export function saveStudioDraft<T>(
  head: StudioHead,
  input: { holderId: string; baseRevision: number; next: T; now: number; ttlMs: number },
): StudioSave<T> {
  const locked = acquireLock(head.lock, input.holderId, head.revision, input.now, input.ttlMs);
  if (!locked.ok) return { ok: false, code: "LOCKED", message: "Another editor holds this form" };
  const saved = saveEdit({ baseRevision: input.baseRevision, currentRevision: head.revision, next: input.next });
  if (!saved.ok) return { ok: false, code: "STALE", message: "A newer revision was saved. Reload before editing." };
  return { ok: true, revision: saved.revision, value: saved.value, review: head.review, lock: { ...locked.lock, revision: saved.revision } };
}

export function renewStudioLock(head: StudioHead, holderId: string, now: number, ttlMs: number): { ok: true; lock: EditLock } | { ok: false; code: string } {
  return renewLock(head.lock, holderId, now, ttlMs);
}

export function releaseStudioLock(head: StudioHead, holderId: string): EditLock | null {
  return releaseLock(head.lock, holderId);
}

export function requestReview(head: StudioHead): { ok: true; review: ReviewState } | { ok: false; code: "REVIEW"; message: string } {
  const moved = transitionReview(head.review, "in_review");
  if (!moved.ok) return { ok: false, code: "REVIEW", message: `Cannot request review from ${head.review}` };
  return { ok: true, review: "in_review" };
}

export function decideReview(
  head: StudioHead,
  to: "approved" | "changes_requested",
): { ok: true; review: ReviewState } | { ok: false; code: "REVIEW"; message: string } {
  const moved = transitionReview(head.review, to);
  if (!moved.ok) return { ok: false, code: "REVIEW", message: `Cannot move from ${head.review} to ${to}` };
  return { ok: true, review: to };
}

/** Publish is refused unless the current review state is approved. */
export function publishIfApproved(head: StudioHead): { ok: true } | { ok: false; code: "REVIEW"; message: string } {
  if (!PUBLISH_FROM.includes(head.review)) {
    return { ok: false, code: "REVIEW", message: "Publish requires an approved review" };
  }
  return { ok: true };
}
