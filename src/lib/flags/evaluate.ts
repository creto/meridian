import type { Queryable } from "../platform/durable.ts";

export type FlagScope = "global" | "tenant" | "workspace" | "user";

export interface FlagRule {
  name: string;
  scope: FlagScope;
  scopeId: string;
  enabled: boolean;
  rollout: number;
}

export interface FlagContext {
  tenantId: string;
  workspaceId?: string;
  userId?: string;
}

const RANK: Record<FlagScope, number> = { global: 0, tenant: 1, workspace: 2, user: 3 };

/** Stable 0..99 bucket. Same name and user always land in the same bucket. */
export function rolloutBucket(name: string, userId: string): number {
  let hash = 0x811c9dc5;
  const text = `${name}:${userId}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

function matches(rule: FlagRule, ctx: FlagContext): boolean {
  if (rule.scope === "global") return rule.scopeId === "*" || rule.scopeId === "";
  if (rule.scope === "tenant") return rule.scopeId === ctx.tenantId;
  if (rule.scope === "workspace") return !!ctx.workspaceId && rule.scopeId === ctx.workspaceId;
  return !!ctx.userId && rule.scopeId === ctx.userId;
}

export function evaluateFlag(rules: FlagRule[], name: string, ctx: FlagContext): boolean {
  const candidates = rules.filter((rule) => rule.name === name && matches(rule, ctx));
  if (!candidates.length) return false;
  candidates.sort((a, b) => RANK[b.scope] - RANK[a.scope]);
  const winner = candidates[0]!;
  if (!winner.enabled) return false;
  const rollout = Math.max(0, Math.min(100, winner.rollout));
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  const bucket = rolloutBucket(name, ctx.userId ?? ctx.tenantId);
  return bucket < rollout;
}

export async function upsertFlagRule(db: Queryable, tenantId: string, rule: FlagRule): Promise<void> {
  await db.query(
    `insert into flag_rules (tenant_id, name, scope, scope_id, enabled, rollout)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (tenant_id, name, scope, scope_id) do update set enabled = excluded.enabled, rollout = excluded.rollout`,
    [tenantId, rule.name, rule.scope, rule.scopeId, rule.enabled, rule.rollout],
  );
}
