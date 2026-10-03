import assert from "node:assert/strict";
import test from "node:test";
import { PREVIEW_CLIENT_ID, PREVIEW_CLIENT_SECRET, grokAuthClientFromEnv } from "./preview.ts";

test("non-production keeps the preview client fallback", () => {
  const dev = grokAuthClientFromEnv({} as NodeJS.ProcessEnv);
  assert.equal(dev.clientId, PREVIEW_CLIENT_ID);
  assert.equal(dev.clientSecret, PREVIEW_CLIENT_SECRET);
  const preview = grokAuthClientFromEnv({ MERIDIAN_ENV: "preview" } as NodeJS.ProcessEnv);
  assert.equal(preview.clientSecret, PREVIEW_CLIENT_SECRET);
});

test("production does not fall back to the embedded preview secret", () => {
  const missing = grokAuthClientFromEnv({ MERIDIAN_ENV: "production" } as NodeJS.ProcessEnv);
  assert.equal(missing.clientId, undefined);
  assert.equal(missing.clientSecret, undefined);
  assert.notEqual(missing.clientSecret, PREVIEW_CLIENT_SECRET);
  const configured = grokAuthClientFromEnv({
    MERIDIAN_ENV: "production",
    GROK_AUTH_CLIENT_ID: "app-client",
    GROK_AUTH_CLIENT_SECRET: "real-secret",
  } as NodeJS.ProcessEnv);
  assert.equal(configured.clientId, "app-client");
  assert.equal(configured.clientSecret, "real-secret");
  assert.notEqual(configured.clientSecret, PREVIEW_CLIENT_SECRET);
});
