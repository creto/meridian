import { authRequired } from "../authz/http-gate.ts";

export interface ConnectorPosture {
  smtp: boolean;
  oidc: boolean;
  s3: boolean;
  ecm: boolean;
}

export interface RuntimePosture {
  database: "postgres" | "pglite";
  masterKey: "env" | "memory" | "missing";
  authRequired: boolean;
  production: boolean;
  productionReady: boolean;
  problems: string[];
  connectors: ConnectorPosture;
}

export function runtimePosture(env: NodeJS.ProcessEnv = process.env): RuntimePosture {
  const production = env.MERIDIAN_ENV === "production";
  const database = env.DATABASE_URL?.trim() ? "postgres" : "pglite";
  const masterKey = env.MERIDIAN_MASTER_KEY?.trim() ? "env" : env.DATABASE_URL?.trim() || production ? "missing" : "memory";
  const problems: string[] = [];
  if (production && database !== "postgres") problems.push("DATABASE_URL is required in production");
  if (production && masterKey !== "env") problems.push("MERIDIAN_MASTER_KEY is required in production");
  if (production && env.MERIDIAN_REQUIRE_AUTH !== "1") problems.push("MERIDIAN_REQUIRE_AUTH=1 is required in production");
  if (production && !env.GROK_AUTH_CLIENT_SECRET?.trim()) problems.push("GROK_AUTH_CLIENT_SECRET is required in production");
  const connectors = {
    smtp: Boolean(env.SMTP_URL?.trim()),
    oidc: Boolean(env.OIDC_ISSUER?.trim() && env.OIDC_CLIENT_ID?.trim()),
    s3: Boolean(env.S3_BUCKET?.trim() && env.S3_ACCESS_KEY_ID?.trim()),
    ecm: Boolean(env.ECM_BASE_URL?.trim()),
  };
  return {
    database,
    masterKey,
    authRequired: production || env.MERIDIAN_REQUIRE_AUTH === "1" || authRequired(),
    production,
    productionReady: production && problems.length === 0,
    problems,
    connectors,
  };
}

export function assertProductionPosture(env: NodeJS.ProcessEnv = process.env): void {
  const posture = runtimePosture(env);
  if (posture.production && posture.problems.length > 0) {
    throw new Error(posture.problems.join("; "));
  }
}
