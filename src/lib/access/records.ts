import { createHash } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import type { AbacPolicy } from "./abac.ts";
import type { PublicationMode, PublicationPolicy } from "./publication.ts";

export interface StoredPublication {
  mode: PublicationMode;
  startAt: string | null;
  endAt: string | null;
  maxSubmissions: number | null;
  linkTokenHash: string | null;
  oneSubmissionPerToken: boolean;
  allowedEmbedDomains: string[];
  allowedOrigins: string[];
}

export function hashLink(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function upsertPublicationRecord(db: Queryable, tenantId: string, formId: string, policy: PublicationPolicy): Promise<void> {
  await db.query(
    `insert into publication_policies (
      tenant_id, form_id, mode, start_at, end_at, max_submissions, link_token_hash, one_per_token, allowed_embed_domains, allowed_origins, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb, now())
    on conflict (tenant_id, form_id) do update set
      mode = excluded.mode,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      max_submissions = excluded.max_submissions,
      link_token_hash = excluded.link_token_hash,
      one_per_token = excluded.one_per_token,
      allowed_embed_domains = excluded.allowed_embed_domains,
      allowed_origins = excluded.allowed_origins,
      updated_at = now()`,
    [
      tenantId,
      formId,
      policy.mode,
      policy.startAt ?? null,
      policy.endAt ?? null,
      policy.maxSubmissions ?? null,
      policy.linkToken ? hashLink(policy.linkToken) : null,
      policy.oneSubmissionPerToken,
      JSON.stringify(policy.allowedEmbedDomains),
      JSON.stringify(policy.allowedOrigins),
    ],
  );
}

export async function loadPublicationRecord(db: Queryable, tenantId: string, formId: string): Promise<StoredPublication | null> {
  const rows = await db.query<Record<string, unknown>>(
    `select mode, start_at, end_at, max_submissions, link_token_hash, one_per_token, allowed_embed_domains, allowed_origins
     from publication_policies where tenant_id = $1 and form_id = $2`,
    [tenantId, formId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    mode: String(row.mode) as PublicationMode,
    startAt: row.start_at == null ? null : String(row.start_at),
    endAt: row.end_at == null ? null : String(row.end_at),
    maxSubmissions: row.max_submissions == null ? null : Number(row.max_submissions),
    linkTokenHash: row.link_token_hash == null ? null : String(row.link_token_hash),
    oneSubmissionPerToken: row.one_per_token === true || row.one_per_token === "t" || row.one_per_token === "true",
    allowedEmbedDomains: asList(row.allowed_embed_domains),
    allowedOrigins: asList(row.allowed_origins),
  };
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function replaceAbac(db: Queryable, tenantId: string, policies: AbacPolicy[]): Promise<number> {
  await db.query("delete from abac_policies where tenant_id = $1", [tenantId]);
  for (const policy of policies) {
    if (!policy.expression.trim()) throw new Error(`Policy ${policy.id} has an empty expression`);
    await db.query(
      "insert into abac_policies (id, tenant_id, action, expression, enabled) values ($1,$2,$3,$4,$5)",
      [policy.id, tenantId, policy.action, policy.expression, policy.enabled],
    );
  }
  return policies.length;
}

export async function loadAbac(db: Queryable, tenantId: string, action: string): Promise<AbacPolicy[]> {
  const rows = await db.query<{ id: string; action: string; expression: string; enabled: unknown }>(
    "select id, action, expression, enabled from abac_policies where tenant_id = $1 and action = $2",
    [tenantId, action],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    expression: row.expression,
    enabled: row.enabled === true || row.enabled === "t" || row.enabled === "true",
  }));
}

export async function saveDataSourceRecord(db: Queryable, input: {
  id: string;
  tenantId: string;
  name: string;
  kind: string;
  config: unknown;
  secretName?: string | null;
  cacheTtlMs?: number;
}): Promise<void> {
  if (input.secretName && !input.secretName.startsWith("secret:")) throw new Error("Data source credential must be a secret reference");
  await db.query(
    `insert into data_sources (id, tenant_id, name, kind, config, secret_name, cache_ttl_ms)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7)
     on conflict (id) do update set name = excluded.name, kind = excluded.kind, config = excluded.config, secret_name = excluded.secret_name, cache_ttl_ms = excluded.cache_ttl_ms`,
    [input.id, input.tenantId, input.name, input.kind, JSON.stringify(input.config), input.secretName ?? null, input.cacheTtlMs ?? 0],
  );
}

export async function saveOidcProviderRecord(db: Queryable, input: {
  id: string;
  tenantId: string;
  name: string;
  issuer: string;
  clientId: string;
  secretName: string;
  scopes: string;
}): Promise<void> {
  if (!input.secretName.startsWith("secret:")) throw new Error("OIDC client secret must be a secret reference");
  await db.query(
    `insert into oidc_providers (id, tenant_id, name, issuer, client_id, secret_name, scopes, enabled)
     values ($1,$2,$3,$4,$5,$6,$7,true)
     on conflict (id) do update set issuer = excluded.issuer, client_id = excluded.client_id, secret_name = excluded.secret_name, scopes = excluded.scopes`,
    [input.id, input.tenantId, input.name, input.issuer, input.clientId, input.secretName, input.scopes],
  );
}

export async function listOidcProviders(db: Queryable, tenantId: string): Promise<Array<{ id: string; name: string; issuer: string; clientId: string; secretName: string }>> {
  return db.query(
    "select id, name, issuer, client_id as \"clientId\", secret_name as \"secretName\" from oidc_providers where tenant_id = $1 order by name",
    [tenantId],
  );
}

export async function saveFlagRuleRecord(db: Queryable, input: {
  tenantId: string;
  name: string;
  scope: "global" | "tenant" | "workspace" | "user";
  scopeId: string;
  enabled: boolean;
  rollout: number;
}): Promise<void> {
  if (input.rollout < 0 || input.rollout > 100) throw new Error("Rollout must be between 0 and 100");
  await db.query(
    `insert into flag_rules (tenant_id, name, scope, scope_id, enabled, rollout)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (tenant_id, name, scope, scope_id) do update set enabled = excluded.enabled, rollout = excluded.rollout`,
    [input.tenantId, input.name, input.scope, input.scopeId, input.enabled, input.rollout],
  );
}
