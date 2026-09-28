import assert from "node:assert/strict";
import test from "node:test";
import { SlidingWindowLimiter, applySecurityHeaders, escapeHtml, issueCsrfToken, securityHeaders, verifyCsrfToken } from "./http.ts";

test("security headers and html escape", () => {
  const headers = securityHeaders();
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  const response = applySecurityHeaders(new Response("ok"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(escapeHtml(`<a href="x">'`), /lt;a/);
});

test("csrf tokens expire and are session bound", () => {
  const token = issueCsrfToken("secret", "ses_1", 1_000, 50);
  assert.equal(verifyCsrfToken("secret", "ses_1", token, 1_020), true);
  assert.equal(verifyCsrfToken("secret", "ses_2", token, 1_020), false);
  assert.equal(verifyCsrfToken("secret", "ses_1", token, 2_000), false);
});

test("sliding window blocks the burst", () => {
  const limiter = new SlidingWindowLimiter(2, 1_000);
  assert.equal(limiter.allow("ip", 0).ok, true);
  assert.equal(limiter.allow("ip", 10).ok, true);
  assert.equal(limiter.allow("ip", 20).ok, false);
  assert.equal(limiter.allow("ip", 1_100).ok, true);
});
