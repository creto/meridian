import assert from "node:assert/strict";
import test from "node:test";
import { createGrokProvider, createLocalProvider, createOpenAiCompatibleProvider } from "./provider.ts";

test("local provider designs a form with a title", async () => {
  const provider = createLocalProvider();
  const health = await provider.healthCheck();
  assert.equal(health.ok, true);
  const result = await provider.generateStructured<{ title: string }>({
    system: "You design enterprise forms.",
    prompt: "form for supplier registration with email and NIT",
    schemaHint: "form",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.provider, "local");
  assert.equal(typeof result.value.title, "string");
  assert.ok(result.value.title.length > 0);
  const refused = await provider.generateStructured({ system: "s", prompt: "summarize", schemaHint: "summary" });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.error, /only designs forms/i);
});

test("openai compatible provider parses fenced JSON from fetchImpl", async () => {
  let called = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    called += 1;
    assert.equal(String(input), "https://example.test/v1/chat/completions");
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-key");
    const body = JSON.parse(String(init?.body)) as { model: string; messages: { role: string }[] };
    assert.equal(body.model, "gpt-test");
    assert.ok(body.messages.some((message) => message.role === "system"));
    assert.ok(body.messages.some((message) => message.role === "user"));
    return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n{\"a\":1}\n```" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const provider = createOpenAiCompatibleProvider({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    model: "gpt-test",
    fetchImpl,
  });
  const result = await provider.generateStructured<{ a: number }>({ system: "sys", prompt: "emit json", schemaHint: "{a:number}" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.a, 1);
  assert.equal(result.provider, "openai-compatible");
  assert.equal(result.model, "gpt-test");
  assert.equal(called, 1);
});

test("grok provider with an empty key does not call fetch", async () => {
  let called = 0;
  const fetchImpl: typeof fetch = async () => {
    called += 1;
    throw new Error("network should not be called");
  };
  const provider = createGrokProvider({ apiKey: "", fetchImpl });
  const health = await provider.healthCheck();
  assert.equal(health.ok, false);
  const result = await provider.generateStructured({ system: "s", prompt: "p", schemaHint: "form" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.provider, "grok");
  assert.equal(called, 0);

  const missing = createGrokProvider();
  const missingHealth = await missing.healthCheck();
  assert.equal(missingHealth.ok, false);
  assert.equal(missing.name, "grok");
});
