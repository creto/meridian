import { decide, type AbacPolicy, type AbacSubject } from "./abac.ts";
import { hashToken, mergePrefill, verifyPrefill } from "./prefill.ts";
import { accessDecision, type AccessDecision, type PublicationPolicy } from "./publication.ts";

export interface FillRequest {
  policy: PublicationPolicy;
  nowIso: string;
  nowMs: number;
  secret?: string;
  prefillToken?: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
  policies: AbacPolicy[];
  subject: AbacSubject;
  action: string;
  expectedTenantId?: string;
  expectedFormId?: string;
}

export type FillAdmit =
  | { ok: true; code: "OK"; data: Record<string, unknown>; rejectedKeys: string[]; consumedToken: string | null }
  | { ok: false; code: string; message: string };

function denyMessage(access: AccessDecision): string {
  switch (access.code) {
    case "TOO_EARLY":
      return "This form is not open yet";
    case "TOO_LATE":
      return "This form has closed";
    case "CAPACITY":
      return "This form has reached its submission limit";
    case "TOKEN":
      return "The public link token is missing or wrong";
    case "TOKEN_REPLAY":
      return "This link was already used";
    case "ORIGIN":
      return "This origin is not allowed";
    case "EMBED_DOMAIN":
      return "This page is not an allowed embedder";
    case "AUTH":
      return "Sign in is required";
    default:
      return "This form is not available in this mode";
  }
}

/**
 * Server admission for a fill or submit.
 * Publication mode is checked first, then the signed prefill token, then ABAC.
 * Query strings and the JSON body cannot overwrite protected fields.
 */
export function admitFill(request: FillRequest): FillAdmit {
  const access = accessDecision(request.policy, request.nowIso);
  if (!access.allow) return { ok: false, code: access.code, message: denyMessage(access) };

  let fields: Record<string, string> = {};
  let protectedFields: string[] = [];
  let consumed: string | null = null;
  if (request.prefillToken) {
    if (!request.secret) return { ok: false, code: "PREFILL", message: "Prefill secret is not configured" };
    const verified = verifyPrefill(request.prefillToken, request.secret, request.nowMs);
    if (!verified.ok) return { ok: false, code: verified.code, message: "Prefill token was rejected" };
    if (request.expectedTenantId && verified.claims.tenantId !== request.expectedTenantId) {
      return { ok: false, code: "BINDING", message: "Prefill token is for another tenant" };
    }
    if (request.expectedFormId && verified.claims.formId !== request.expectedFormId) {
      return { ok: false, code: "BINDING", message: "Prefill token is for another form" };
    }
    fields = verified.claims.fields;
    protectedFields = verified.claims.protectedFields;
    consumed = hashToken(request.prefillToken);
  }

  const merged = mergePrefill(fields, request.query, protectedFields);
  const data: Record<string, unknown> = { ...merged.data };
  const rejected = [...merged.rejectedKeys];
  for (const [key, value] of Object.entries(request.body)) {
    if (protectedFields.includes(key)) {
      if (!rejected.includes(key)) rejected.push(key);
      continue;
    }
    data[key] = value;
  }
  for (const key of protectedFields) {
    if (key in fields) data[key] = fields[key];
  }

  const subject: AbacSubject = {
    ...request.subject,
    submission: { ...request.subject.submission, ...data },
  };
  const authz = decide(request.action, request.policies, subject);
  if (!authz.allow) return { ok: false, code: "ABAC", message: `Denied by ${authz.failed.join(", ")}` };
  return { ok: true, code: "OK", data, rejectedKeys: rejected, consumedToken: consumed };
}

/** After a successful submit, capacity moves and a one-time link token is spent. */
export function noteConsumption(policy: PublicationPolicy, presentedToken: string | null): PublicationPolicy {
  const next = policy.submissionsSoFar + 1;
  if (!presentedToken || !policy.oneSubmissionPerToken) return { ...policy, submissionsSoFar: next };
  if (policy.usedTokens.includes(presentedToken)) return { ...policy, submissionsSoFar: next };
  return { ...policy, submissionsSoFar: next, usedTokens: [...policy.usedTokens, presentedToken] };
}
