import assert from "node:assert/strict";
import test from "node:test";
import { guard } from "./http-gate.ts";

test("preview can act on its own tenant and not on another", async () => {
  const previous = process.env.MERIDIAN_REQUIRE_AUTH;
  const env = process.env.MERIDIAN_ENV;
  delete process.env.MERIDIAN_REQUIRE_AUTH;
  delete process.env.MERIDIAN_ENV;
  try {
    const own = await guard(new Request("http://meridian.local"), "form.read", { type: "form" });
    assert.equal(own.ok, true);
    if (own.ok) assert.equal(own.actor.tenantId, "ten_northwind");
    const other = await guard(new Request("http://meridian.local"), "admin", { tenantId: "ten_contoso", type: "tenant" });
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.response.status, 403);
  } finally {
    if (previous === undefined) delete process.env.MERIDIAN_REQUIRE_AUTH;
    else process.env.MERIDIAN_REQUIRE_AUTH = previous;
    if (env === undefined) delete process.env.MERIDIAN_ENV;
    else process.env.MERIDIAN_ENV = env;
  }
});

test("production rejects a request with no API key", async () => {
  const previous = process.env.MERIDIAN_REQUIRE_AUTH;
  process.env.MERIDIAN_REQUIRE_AUTH = "1";
  try {
    const denied = await guard(new Request("http://meridian.local"), "form.read", { type: "form" });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.response.status, 401);
  } finally {
    if (previous === undefined) delete process.env.MERIDIAN_REQUIRE_AUTH;
    else process.env.MERIDIAN_REQUIRE_AUTH = previous;
  }
});
