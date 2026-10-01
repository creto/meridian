import assert from "node:assert/strict";
import test from "node:test";
import { exportOtlp, Tracer } from "./otel.ts";

test("spans stay local until an OTLP endpoint is configured", async () => {
  const tracer = new Tracer();
  const span = tracer.startSpan("http.request", { attributes: { authorization: "secret" } });
  tracer.end(span);
  const skipped = await exportOtlp(tracer, fetch, {} as NodeJS.ProcessEnv);
  assert.equal(skipped.exported, false);
  let body = "";
  const sent = await exportOtlp(tracer, (async (_url, init) => {
    body = String(init?.body ?? "");
    return new Response("ok", { status: 200 });
  }) as typeof fetch, { OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318" } as NodeJS.ProcessEnv);
  assert.equal(sent.exported, true);
  assert.equal(body.includes("secret"), false);
  assert.equal(body.includes("http.request"), true);
});
