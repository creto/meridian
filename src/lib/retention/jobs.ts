import { filterDeletable, retentionDecision, type RetentionPolicy } from "../retention/policy.ts";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface RetentionPlan {
  deletableSubmissionIds: string[];
  held: number;
  forever: number;
}

interface SettingsRow {
  retention: string;
  retention_days: number | null;
  legal_hold: boolean | string | number | null;
}

interface SubmissionRow {
  id: string;
  created_at: string | Date;
}

function isLegalHold(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function policyFromRow(row: SettingsRow | undefined): RetentionPolicy {
  if (!row) return { retention: "forever", legalHold: false };
  const days = row.retention_days == null ? undefined : Number(row.retention_days);
  return {
    retention: row.retention === "days" ? "days" : "forever",
    retentionDays: days != null && Number.isFinite(days) ? days : undefined,
    legalHold: isLegalHold(row.legal_hold),
  };
}

function createdAtIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

/**
 * Plan which submission payloads may be wiped. This never deletes audit rows.
 * Missing tenant_settings is forever: nothing is deletable.
 */
export async function planRetention(db: Queryable, tenantId: string, now = new Date()): Promise<RetentionPlan> {
  const settings = await db.query<SettingsRow>(
    "select retention, retention_days, legal_hold from tenant_settings where tenant_id = $1",
    [tenantId],
  );
  const policy = policyFromRow(settings[0]);
  const rows = await db.query<SubmissionRow>("select id, created_at from submissions where tenant_id = $1", [tenantId]);
  const nowMs = now.getTime();
  const shaped = rows.map((row) => ({ id: row.id, createdAt: createdAtIso(row.created_at) }));
  const deletableSubmissionIds = filterDeletable(shaped, policy, nowMs).map((row) => row.id);
  let held = 0;
  let forever = 0;
  for (const row of shaped) {
    const decision = retentionDecision(policy, row.createdAt, nowMs);
    if (decision.reason === "legal-hold") held += 1;
    else if (decision.reason === "forever") forever += 1;
  }
  return { deletableSubmissionIds, held, forever };
}

/**
 * Wipe submission payloads for this tenant only. Status becomes `deleted` and
 * data becomes an empty object. Audit tables are left intact. A legal hold
 * checked here returns 0 and writes nothing, even if the caller passes ids.
 */
export async function purgeSubmissionData(db: Queryable, tenantId: string, ids: string[]): Promise<number> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  if (unique.length === 0) return 0;
  const settings = await db.query<{ legal_hold: boolean | string | number | null }>(
    "select legal_hold from tenant_settings where tenant_id = $1",
    [tenantId],
  );
  if (isLegalHold(settings[0]?.legal_hold)) return 0;
  let count = 0;
  for (const id of unique) {
    const updated = await db.query<{ id: string }>(
      "update submissions set status = 'deleted', data = '{}'::jsonb where tenant_id = $1 and id = $2 returning id",
      [tenantId, id],
    );
    count += updated.length;
  }
  return count;
}
