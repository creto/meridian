import { createHash, randomBytes } from "node:crypto";

export interface DiscoveryDocument {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  endSessionEndpoint?: string;
}

export function parseDiscovery(doc: unknown): DiscoveryDocument {
  if (!doc || typeof doc !== "object") throw new Error("Discovery document is missing");
  const record = doc as Record<string, unknown>;
  const issuer = stringField(record, "issuer");
  const authorizationEndpoint = stringField(record, "authorization_endpoint");
  const tokenEndpoint = stringField(record, "token_endpoint");
  const jwksUri = stringField(record, "jwks_uri");
  const end = record.end_session_endpoint;
  return {
    issuer,
    authorizationEndpoint,
    tokenEndpoint,
    jwksUri,
    endSessionEndpoint: typeof end === "string" ? end : undefined,
  };
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value) throw new Error(`Discovery is missing ${key}`);
  return value;
}

function b64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export function createPkce(): { verifier: string; challenge: string; method: "S256" } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" };
}

export function createAuthTransaction(): { state: string; nonce: string } {
  return { state: randomBytes(16).toString("base64url"), nonce: randomBytes(16).toString("base64url") };
}

export function buildAuthorizeUrl(input: {
  discovery: DiscoveryDocument;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  challenge: string;
}): string {
  const url = new URL(input.discovery.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function tokenRequestBody(code: string, verifier: string, redirectUri: string, clientId: string): string {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", clientId);
  body.set("code_verifier", verifier);
  return body.toString();
}

export interface ClaimMapping {
  userId?: string;
  email?: string;
  name?: string;
  tenantId?: string;
  roles?: string;
  workspaceIds?: string;
}

export interface MappedIdentity {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  roles: string[];
  workspaceIds: string[];
}

function claim(claims: Record<string, unknown>, key: string | undefined, fallback: string): unknown {
  return claims[key ?? fallback];
}

export function mapClaims(claims: Record<string, unknown>, mapping: ClaimMapping = {}): MappedIdentity {
  const roles = claim(claims, mapping.roles, "roles");
  const workspaces = claim(claims, mapping.workspaceIds, "workspace_ids");
  return {
    userId: String(claim(claims, mapping.userId, "sub") ?? ""),
    email: String(claim(claims, mapping.email, "email") ?? ""),
    name: String(claim(claims, mapping.name, "name") ?? ""),
    tenantId: String(claim(claims, mapping.tenantId, "tenant_id") ?? ""),
    roles: Array.isArray(roles) ? roles.map(String) : [],
    workspaceIds: Array.isArray(workspaces) ? workspaces.map(String) : [],
  };
}

const SECRET_KEYS = ["client_secret", "password", "access_token", "refresh_token", "id_token"];

export function redactOidc(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactOidc(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.includes(key) ? "***" : redactOidc(inner);
    }
    return out;
  }
  return value;
}
