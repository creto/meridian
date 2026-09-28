import type { Queryable } from "../platform/durable.ts";

export type PublicationMode = "PRIVATE" | "AUTHENTICATED" | "PUBLIC_LINK" | "EMBEDDED" | "API_ONLY";

export interface PublicationPolicy {
  mode: PublicationMode;
  startAt?: string | null;
  endAt?: string | null;
  maxSubmissions?: number | null;
  submissionsSoFar: number;
  linkToken?: string | null;
  presentedToken?: string | null;
  oneSubmissionPerToken: boolean;
  usedTokens: string[];
  allowedEmbedDomains: string[];
  allowedOrigins: string[];
  origin?: string | null;
  embedder?: string | null;
  hasSession: boolean;
  viaApi: boolean;
}

export interface AccessDecision {
  allow: boolean;
  code: "OK" | "MODE" | "TOO_EARLY" | "TOO_LATE" | "CAPACITY" | "TOKEN" | "TOKEN_REPLAY" | "ORIGIN" | "EMBED_DOMAIN" | "AUTH";
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

export function accessDecision(policy: PublicationPolicy, nowIso: string): AccessDecision {
  const now = Date.parse(nowIso);
  if (policy.startAt && Date.parse(policy.startAt) > now) return { allow: false, code: "TOO_EARLY" };
  if (policy.endAt && Date.parse(policy.endAt) < now) return { allow: false, code: "TOO_LATE" };
  if (policy.maxSubmissions != null && policy.submissionsSoFar >= policy.maxSubmissions) return { allow: false, code: "CAPACITY" };
  if (policy.mode === "PRIVATE" && !policy.hasSession) return { allow: false, code: "AUTH" };
  if (policy.mode === "AUTHENTICATED" && !policy.hasSession) return { allow: false, code: "AUTH" };
  if (policy.mode === "API_ONLY" && !policy.viaApi) return { allow: false, code: "MODE" };
  if (policy.mode === "PUBLIC_LINK") {
    if (!policy.presentedToken || policy.presentedToken !== policy.linkToken) return { allow: false, code: "TOKEN" };
    if (policy.oneSubmissionPerToken && policy.usedTokens.includes(policy.presentedToken)) return { allow: false, code: "TOKEN_REPLAY" };
  }
  if (policy.mode === "EMBEDDED") {
    const embedder = hostOf(policy.embedder);
    const allowed = policy.allowedEmbedDomains.map((domain) => domain.toLowerCase());
    if (!embedder || !allowed.includes(embedder)) return { allow: false, code: "EMBED_DOMAIN" };
  }
  if (policy.allowedOrigins.length && policy.origin) {
    const origin = hostOf(policy.origin);
    const allowed = policy.allowedOrigins.map((item) => hostOf(item));
    if (!origin || !allowed.includes(origin)) return { allow: false, code: "ORIGIN" };
  }
  return { allow: true, code: "OK" };
}

export async function savePublication(db: Queryable, tenantId: string, formId: string, policy: PublicationPolicy): Promise<void> {
  await db.query(
    `insert into publication_policies (
      tenant_id, form_id, mode, start_at, end_at, max_submissions, link_token_hash, one_per_token, allowed_embed_domains, allowed_origins, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb, now())
    on conflict (tenant_id, form_id) do update set
      mode = excluded.mode, start_at = excluded.start_at, end_at = excluded.end_at,
      max_submissions = excluded.max_submissions, link_token_hash = excluded.link_token_hash,
      one_per_token = excluded.one_per_token, allowed_embed_domains = excluded.allowed_embed_domains,
      allowed_origins = excluded.allowed_origins, updated_at = now()`,
    [
      tenantId,
      formId,
      policy.mode,
      policy.startAt ?? null,
      policy.endAt ?? null,
      policy.maxSubmissions ?? null,
      policy.linkToken ?? null,
      policy.oneSubmissionPerToken,
      JSON.stringify(policy.allowedEmbedDomains),
      JSON.stringify(policy.allowedOrigins),
    ],
  );
}
