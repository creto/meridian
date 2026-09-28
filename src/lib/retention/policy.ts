export interface RetentionPolicy {
  retention: "forever" | "days";
  retentionDays?: number;
  legalHold: boolean;
}

export interface RetentionDecision {
  deletable: boolean;
  reason: "legal-hold" | "forever" | "within-window" | "expired";
}

export function retentionDecision(policy: RetentionPolicy, createdAt: string, now = Date.now()): RetentionDecision {
  if (policy.legalHold) return { deletable: false, reason: "legal-hold" };
  if (policy.retention === "forever") return { deletable: false, reason: "forever" };
  const days = policy.retentionDays ?? 0;
  if (days <= 0) return { deletable: false, reason: "within-window" };
  const age = now - Date.parse(createdAt);
  if (!Number.isFinite(age)) return { deletable: false, reason: "within-window" };
  if (age >= days * 86_400_000) return { deletable: true, reason: "expired" };
  return { deletable: false, reason: "within-window" };
}

/** Jobs call this. Legal hold wins even if the row is older than the window. */
export function filterDeletable<T extends { createdAt: string }>(rows: T[], policy: RetentionPolicy, now = Date.now()): T[] {
  if (policy.legalHold) return [];
  return rows.filter((row) => retentionDecision(policy, row.createdAt, now).deletable);
}
