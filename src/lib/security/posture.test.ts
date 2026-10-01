import assert from "node:assert/strict";
import test from "node:test";
import { assertProductionPosture, runtimePosture } from "./posture.ts";

test("production refuses the embedded database and a missing master key", () => {
  const posture = runtimePosture({ MERIDIAN_ENV: "production" } as NodeJS.ProcessEnv);
  assert.equal(posture.database, "pglite");
  assert.equal(posture.masterKey, "missing");
  assert.equal(posture.connectors.smtp, false);
  assert.equal(posture.productionReady, false);
  assert.throws(() => assertProductionPosture({ MERIDIAN_ENV: "production" } as NodeJS.ProcessEnv), /DATABASE_URL/);
});

test("a managed database with a master key and required auth is production ready", () => {
  const posture = runtimePosture({
    MERIDIAN_ENV: "production",
    MERIDIAN_REQUIRE_AUTH: "1",
    DATABASE_URL: "postgres://meridian@db/meridian",
    MERIDIAN_MASTER_KEY: "a".repeat(64),
    SMTP_URL: "",
    OIDC_ISSUER: "https://login.example",
    OIDC_CLIENT_ID: "meridian",
  } as NodeJS.ProcessEnv);
  assert.equal(posture.productionReady, true);
  assert.equal(posture.database, "postgres");
  assert.equal(posture.masterKey, "env");
  assert.equal(posture.connectors.oidc, true);
  assert.equal(posture.connectors.smtp, false);
});
