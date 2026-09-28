import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { buildAuthorizeUrl, createAuthTransaction, createPkce, mapClaims, parseDiscovery, tokenRequestBody, type DiscoveryDocument } from "./oidc.ts";

export type IdentityProviderKind = "local" | "oidc";

export interface OidcClient {
  id: string;
  issuer: string;
  clientId: string;
  secretRef: string;
  scopes: string[];
  redirectUri: string;
  enabled: boolean;
}

export interface AuthTransactionRecord {
  state: string;
  nonce: string;
  verifier: string;
  providerId: string;
  redirectUri: string;
  expiresAt: number;
}

export interface IdentitySession {
  sessionId: string;
  provider: IdentityProviderKind;
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  nonce?: string;
}

const transactions = new Map<string, AuthTransactionRecord>();

export function resetIdentityTransactions(): void {
  transactions.clear();
}

export function assertSecretRef(secretRef: string): void {
  if (!secretRef.startsWith("secret:")) throw new Error("OIDC client secret must be a secret reference");
}

export function beginOidc(provider: OidcClient, discoveryDoc: unknown, now: number, ttlMs = 10 * 60_000): { url: string; record: AuthTransactionRecord } {
  if (!provider.enabled) throw new Error("OIDC provider is disabled");
  assertSecretRef(provider.secretRef);
  const discovery = parseDiscovery(discoveryDoc);
  if (discovery.issuer !== provider.issuer) throw new Error("Discovery issuer does not match the configured provider");
  const pkce = createPkce();
  const tx = createAuthTransaction();
  const record: AuthTransactionRecord = {
    state: tx.state,
    nonce: tx.nonce,
    verifier: pkce.verifier,
    providerId: provider.id,
    redirectUri: provider.redirectUri,
    expiresAt: now + ttlMs,
  };
  transactions.set(record.state, record);
  const url = buildAuthorizeUrl({
    discovery,
    clientId: provider.clientId,
    redirectUri: provider.redirectUri,
    scopes: provider.scopes,
    state: record.state,
    nonce: record.nonce,
    challenge: pkce.challenge,
  });
  return { url, record };
}

export function takeTransaction(state: string, now: number): AuthTransactionRecord | { ok: false; code: "STATE" | "EXPIRED" } {
  const record = transactions.get(state);
  if (!record) return { ok: false, code: "STATE" };
  transactions.delete(state);
  if (record.expiresAt < now) return { ok: false, code: "EXPIRED" };
  return record;
}

export interface TokenResponse {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
}

function decodePayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2 || !parts[1]) throw new Error("id_token is not a JWT");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * Authorization-code callback.
 * Checks state, PKCE verifier binding, and nonce. Does not log the client secret.
 * Signature verification of the id_token requires the provider JWKS and is reported as unverified.
 */
export function completeOidcCallback(input: {
  state: string;
  code: string;
  now: number;
  token: TokenResponse;
  expectedNonce: string;
}): { session: Omit<IdentitySession, "sessionId">; refresh: boolean; idTokenVerified: false; body: URLSearchParams } | { ok: false; code: string } {
  const tx = takeTransaction(input.state, input.now);
  if ("ok" in tx) return tx;
  if (!input.code) return { ok: false, code: "CODE" };
  const claims = input.token.id_token ? decodePayload(input.token.id_token) : {};
  if (input.token.id_token && claims.nonce !== input.expectedNonce) return { ok: false, code: "NONCE" };
  if (claims.nonce && claims.nonce !== tx.nonce) return { ok: false, code: "NONCE" };
  const mapped = mapClaims(claims);
  const body = new URLSearchParams(tokenRequestBody(input.code, tx.verifier, tx.redirectUri, "redacted-client"));
  return {
    session: {
      provider: "oidc",
      userId: mapped.userId || `oidc_${createHash("sha256").update(input.state).digest("hex").slice(0, 12)}`,
      tenantId: mapped.tenantId || "",
      email: mapped.email || "",
      roles: mapped.roles,
      nonce: tx.nonce,
    },
    refresh: Boolean(input.token.refresh_token),
    idTokenVerified: false,
    body,
  };
}

export function logoutUrl(discovery: DiscoveryDocument, idTokenHint: string | null, postLogout: string): string | null {
  if (!discovery.endSessionEndpoint) return null;
  const url = new URL(discovery.endSessionEndpoint);
  if (idTokenHint) url.searchParams.set("id_token_hint", idTokenHint);
  url.searchParams.set("post_logout_redirect_uri", postLogout);
  return url.toString();
}

export function localSession(input: { userId: string; tenantId: string; email: string; roles: string[] }): IdentitySession {
  return {
    sessionId: `sess_${randomBytes(8).toString("hex")}`,
    provider: "local",
    userId: input.userId,
    tenantId: input.tenantId,
    email: input.email,
    roles: input.roles,
  };
}

export function sessionCookie(session: IdentitySession, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ sid: session.sessionId, uid: session.userId, tid: session.tenantId })).toString("base64url");
  const sig = createHash("sha256").update(`${payload}.${secret}`).digest("base64url");
  return `meridian_session=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/`;
}

export function verifySessionCookie(cookie: string, secret: string): { sid: string; uid: string; tid: string } | null {
  const raw = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("meridian_session="));
  if (!raw) return null;
  const value = raw.slice("meridian_session=".length);
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = createHash("sha256").update(`${payload}.${secret}`).digest("base64url");
  const left = Buffer.from(expected);
  const right = Buffer.from(sig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sid: string; uid: string; tid: string };
  if (!parsed.sid || !parsed.uid || !parsed.tid) return null;
  return parsed;
}
