import assert from "node:assert/strict";
import test from "node:test";
import { MeridianClient, MeridianError } from "./client.ts";

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function install(handler: (call: Captured) => Response): { calls: Captured[]; fetchImpl: typeof fetch } {
  const calls: Captured[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: Captured = {
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    return handler(call);
  };
  return { calls, fetchImpl };
}

test("client calls agent routes with bearer auth and strips trailing slashes", async () => {
  const { calls, fetchImpl } = install((call) => jsonResponse(200, { path: call.url, ok: true }));
  const client = new MeridianClient({ baseUrl: "https://meridian.example/app/", apiKey: "mdn_live_test", fetchImpl });

  const listed = await client.listForms<{ path: string }>();
  assert.equal(listed.path, "https://meridian.example/app/api/agent/v1/forms");
  await client.getForm("a b");
  await client.formCapabilities("intake");
  await client.formInputSchema("intake");
  await client.formToolDefinition("intake");
  await client.formOpenApi("intake");
  await client.generateForm("a supplier form");
  await client.validateObject("intake", { name: "Ada" });
  await client.submitObject("intake", { name: "Ada" });
  await client.getSubmission("sub/1");
  await client.patchSubmission("sub/1", { name: "Grace" });
  await client.startWorkflow("wf/1", { actor: "ada" });
  await client.getWorkflowInstance("inst 9");
  await client.getJob("job/1");
  await client.retryJob("job/1");
  await client.cancelJob("job/1");
  await client.uploadFile({ name: "a.pdf", contentType: "application/pdf" });

  assert.equal(calls.length, 17);
  const paths = calls.map((call) => call.url.replace("https://meridian.example/app", ""));
  assert.deepEqual(paths, [
    "/api/agent/v1/forms",
    "/api/agent/v1/forms/a%20b",
    "/api/agent/v1/forms/intake/capabilities",
    "/api/agent/v1/forms/intake/input-schema",
    "/api/agent/v1/forms/intake/tool-definition",
    "/api/agent/v1/forms/intake/openapi",
    "/api/agent/v1/forms/generate",
    "/api/agent/v1/forms/intake/validate-object",
    "/api/agent/v1/forms/intake/submit-object",
    "/api/agent/v1/submissions/sub%2F1",
    "/api/agent/v1/submissions/sub%2F1",
    "/api/agent/v1/workflows/wf%2F1/start",
    "/api/agent/v1/workflows/instances/inst%209",
    "/api/agent/v1/jobs/job%2F1",
    "/api/agent/v1/jobs/job%2F1/retry",
    "/api/agent/v1/jobs/job%2F1/cancel",
    "/api/agent/v1/files",
  ]);

  for (const call of calls) {
    assert.equal(call.headers.Authorization, "Bearer mdn_live_test");
    assert.equal(call.headers.Accept, "application/json");
    assert.equal(call.url.includes("//api/"), false);
  }

  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.body, undefined);
  assert.equal(calls[0]?.headers["Content-Type"], undefined);

  assert.equal(calls[6]?.method, "POST");
  assert.deepEqual(JSON.parse(calls[6]?.body ?? ""), { prompt: "a supplier form" });
  assert.equal(calls[6]?.headers["Content-Type"], "application/json");

  assert.deepEqual(JSON.parse(calls[7]?.body ?? ""), { data: { name: "Ada" } });
  assert.deepEqual(JSON.parse(calls[8]?.body ?? ""), { data: { name: "Ada" } });
  assert.equal(calls[8]?.headers["Idempotency-Key"], undefined);

  assert.equal(calls[10]?.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[10]?.body ?? ""), { data: { name: "Grace" } });

  assert.equal(calls[11]?.method, "POST");
  assert.deepEqual(JSON.parse(calls[11]?.body ?? ""), { actor: "ada" });

  assert.equal(calls[14]?.method, "POST");
  assert.equal(calls[14]?.body, undefined);
  assert.equal(calls[15]?.method, "POST");
  assert.equal(calls[15]?.body, undefined);
  assert.deepEqual(JSON.parse(calls[16]?.body ?? ""), { name: "a.pdf", contentType: "application/pdf" });
});

test("submitObject sends Idempotency-Key only when provided", async () => {
  const { calls, fetchImpl } = install(() => jsonResponse(201, { submissionId: "sub_1" }));
  const client = new MeridianClient({ baseUrl: "https://meridian.example", apiKey: "k", fetchImpl });
  const created = await client.submitObject("form", { qty: 2 }, { idempotencyKey: "idem-1" });
  assert.deepEqual(created, { submissionId: "sub_1" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.headers["Idempotency-Key"], "idem-1");
  assert.equal(calls[0]?.headers.Authorization, "Bearer k");
  assert.equal(calls[0]?.url, "https://meridian.example/api/agent/v1/forms/form/submit-object");

  await client.submitObject("form", { qty: 2 });
  assert.equal(calls[1]?.headers["Idempotency-Key"], undefined);
  assert.equal(calls.length, 2);
});

test("non-2xx responses throw MeridianError parsed from the error envelope", async () => {
  const { calls, fetchImpl } = install(
    () =>
      jsonResponse(422, {
        error: { code: "FORM_VALIDATION_FAILED", message: "Submission contains invalid fields", details: { name: "required" } },
      }),
  );
  const client = new MeridianClient({ baseUrl: "https://meridian.example/", apiKey: "k", fetchImpl });
  await assert.rejects(
    () => client.validateObject("intake", {}),
    (error: unknown) => {
      assert.ok(error instanceof MeridianError);
      assert.equal(error.name, "MeridianError");
      assert.equal(error.status, 422);
      assert.equal(error.code, "FORM_VALIDATION_FAILED");
      assert.equal(error.message, "Submission contains invalid fields");
      assert.deepEqual(error.details, { name: "required" });
      return true;
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.headers.Accept, "application/json");
});

test("error parsing falls back when the body is not the error envelope", async () => {
  const { fetchImpl } = install(() => new Response("nope", { status: 500 }));
  const client = new MeridianClient({ baseUrl: "https://meridian.example", apiKey: "k", fetchImpl });
  await assert.rejects(
    () => client.getJob("job"),
    (error: unknown) => {
      assert.ok(error instanceof MeridianError);
      assert.equal(error.status, 500);
      assert.equal(error.code, "HTTP_ERROR");
      assert.equal(error.message, "nope");
      assert.equal(error.details, undefined);
      return true;
    },
  );

  const wrapped = install(() => jsonResponse(404, { error: "missing" }));
  const other = new MeridianClient({ baseUrl: "https://meridian.example", apiKey: "k", fetchImpl: wrapped.fetchImpl });
  await assert.rejects(
    () => other.getSubmission("missing"),
    (error: unknown) => {
      assert.ok(error instanceof MeridianError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "HTTP_ERROR");
      assert.equal(error.message, "HTTP 404");
      return true;
    },
  );
});
