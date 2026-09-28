import assert from "node:assert/strict";
import test from "node:test";
import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOL_NAMES,
  JsonRpcCode,
  formResourceUri,
  handleMcpMessage,
  redact,
  type JsonRpcFailure,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type McpContext,
  type McpHost,
} from "./protocol.ts";

function createHost(overrides: Partial<McpHost> = {}): { host: McpHost; calls: string[] } {
  const calls: string[] = [];
  const host: McpHost = {
    listForms: (tenantId) => {
      calls.push("listForms");
      return overrides.listForms ? overrides.listForms(tenantId) : [];
    },
    getForm: (tenantId, formId) => {
      calls.push("getForm");
      return overrides.getForm ? overrides.getForm(tenantId, formId) : null;
    },
    generateForm: (tenantId, args) => {
      calls.push("generateForm");
      return overrides.generateForm ? overrides.generateForm(tenantId, args) : null;
    },
    validateSubmission: (tenantId, args) => {
      calls.push("validateSubmission");
      return overrides.validateSubmission ? overrides.validateSubmission(tenantId, args) : null;
    },
    createSubmission: (tenantId, args) => {
      calls.push("createSubmission");
      return overrides.createSubmission ? overrides.createSubmission(tenantId, args) : null;
    },
    getSubmission: (tenantId, args) => {
      calls.push("getSubmission");
      return overrides.getSubmission ? overrides.getSubmission(tenantId, args) : null;
    },
    searchSubmissions: (tenantId, args) => {
      calls.push("searchSubmissions");
      return overrides.searchSubmissions ? overrides.searchSubmissions(tenantId, args) : [];
    },
    updateSubmission: (tenantId, args) => {
      calls.push("updateSubmission");
      return overrides.updateSubmission ? overrides.updateSubmission(tenantId, args) : null;
    },
    startWorkflow: (tenantId, args) => {
      calls.push("startWorkflow");
      return overrides.startWorkflow ? overrides.startWorkflow(tenantId, args) : null;
    },
    getWorkflow: (tenantId, args) => {
      calls.push("getWorkflow");
      return overrides.getWorkflow ? overrides.getWorkflow(tenantId, args) : null;
    },
    getJob: (tenantId, args) => {
      calls.push("getJob");
      return overrides.getJob ? overrides.getJob(tenantId, args) : null;
    },
    uploadFile: (tenantId, args) => {
      calls.push("uploadFile");
      return overrides.uploadFile ? overrides.uploadFile(tenantId, args) : null;
    },
  };
  return { host, calls };
}

function ctx(scopes: readonly string[] = [], tenantId = "ten"): McpContext {
  return { tenantId, scopes };
}

function asSuccess(response: JsonRpcResponse | JsonRpcResponse[] | null): JsonRpcSuccess {
  assert.ok(response && !Array.isArray(response) && "result" in response);
  return response;
}

function asFailure(response: JsonRpcResponse | JsonRpcResponse[] | null): JsonRpcFailure {
  assert.ok(response && !Array.isArray(response) && "error" in response);
  return response;
}

test("redact replaces secret-bearing keys and does not mutate the input", () => {
  const input = {
    note: "visible",
    password: "super-secret-value",
    profile: { token: "super-secret-value", apiKey: "super-secret-value" },
    items: [{ authorization: "super-secret-value", secret: "super-secret-value", keep: 1 }],
    Secret: "super-secret-value",
  };
  const redacted = redact(input) as {
    note: string;
    password: string;
    profile: { token: string; apiKey: string };
    items: Array<{ authorization: string; secret: string; keep: number }>;
    Secret: string;
  };
  assert.equal(redacted.note, "visible");
  assert.equal(redacted.password, "***");
  assert.equal(redacted.profile.token, "***");
  assert.equal(redacted.profile.apiKey, "***");
  assert.equal(redacted.items[0]?.authorization, "***");
  assert.equal(redacted.items[0]?.secret, "***");
  assert.equal(redacted.items[0]?.keep, 1);
  assert.equal(redacted.Secret, "***");
  assert.equal(input.password, "super-secret-value");
  assert.equal(JSON.stringify(redacted).includes("super-secret-value"), false);
});

test("initialize, ping, and notifications/initialized", async () => {
  const { host, calls } = createHost();
  const init = asSuccess(
    await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2020-01-01" } }, ctx(), host),
  );
  assert.deepEqual(init.result, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    capabilities: { tools: {}, resources: {} },
  });
  assert.equal(MCP_PROTOCOL_VERSION, "2025-06-18");
  assert.equal(MCP_SERVER_VERSION, "0.9.0");

  const ping = asSuccess(await handleMcpMessage({ jsonrpc: "2.0", id: "p", method: "ping" }, ctx(), host));
  assert.deepEqual(ping, { jsonrpc: "2.0", id: "p", result: {} });

  const noted = asSuccess(await handleMcpMessage({ jsonrpc: "2.0", id: 7, method: "notifications/initialized" }, ctx(), host));
  assert.deepEqual(noted.result, {});
  assert.equal(calls.length, 0);
});

test("tools/list returns the fixed tool names and does not call the host", async () => {
  const { host, calls } = createHost();
  const listed = asSuccess(await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx(), host));
  const tools = (listed.result as { tools: Array<{ name: string }> }).tools;
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [...MCP_TOOL_NAMES],
  );
  assert.equal(calls.length, 0);
});

test("successful tools/call returns host data and passes the tenant", async () => {
  const seen: { tenantId?: string; args?: Record<string, unknown>; formId?: string } = {};
  const { host, calls } = createHost({
    listForms: async (tenantId) => {
      seen.tenantId = tenantId;
      return [{ id: "form_1", name: "intake", title: "Intake" }];
    },
    searchSubmissions: (tenantId, args) => {
      seen.tenantId = tenantId;
      seen.args = args;
      return [{ id: "sub_1" }];
    },
    getForm: (tenantId, formId) => {
      seen.tenantId = tenantId;
      seen.formId = formId;
      return { id: formId, title: "Intake" };
    },
  });

  const listed = asSuccess(
    await handleMcpMessage(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "forms.list" } },
      ctx(["forms.list"]),
      host,
    ),
  );
  const listedBody = listed.result as { structuredContent: Array<{ id: string }>; content: Array<{ type: string; text: string }> };
  assert.equal(seen.tenantId, "ten");
  assert.deepEqual(listedBody.structuredContent, [{ id: "form_1", name: "intake", title: "Intake" }]);
  assert.equal(listedBody.content[0]?.type, "text");
  assert.deepEqual(JSON.parse(listedBody.content[0]?.text ?? ""), listedBody.structuredContent);

  const searched = asSuccess(
    await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "submissions.search", arguments: { query: "ada" } },
      },
      ctx(["submissions.search"]),
      host,
    ),
  );
  assert.deepEqual((searched.result as { structuredContent: unknown }).structuredContent, [{ id: "sub_1" }]);
  assert.deepEqual(seen.args, { query: "ada" });

  const got = asSuccess(
    await handleMcpMessage(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "forms.get", arguments: { id: "form_1" } } },
      ctx(["forms.get"]),
      host,
    ),
  );
  assert.equal(seen.formId, "form_1");
  assert.deepEqual((got.result as { structuredContent: { id: string } }).structuredContent, { id: "form_1", title: "Intake" });
  assert.deepEqual(calls, ["listForms", "searchSubmissions", "getForm"]);
});

test("scope denial does not call the host", async () => {
  const { host, calls } = createHost({
    listForms: () => {
      throw new Error("host should not run");
    },
    createSubmission: () => {
      throw new Error("host should not run");
    },
  });
  const secret = "super-secret-value";
  const denied = asFailure(
    await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "forms.list", arguments: { password: secret, note: "visible" } },
      },
      ctx(["forms.get", "forms.*"]),
      host,
    ),
  );
  assert.equal(denied.error.code, JsonRpcCode.Forbidden);
  assert.equal(denied.error.message, "Forbidden");
  assert.equal(JSON.stringify(denied).includes(secret), false);
  assert.equal(calls.length, 0);

  const wildcard = asFailure(
    await handleMcpMessage(
      { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "submissions.create", arguments: { token: secret } } },
      ctx(["submissions.*"]),
      host,
    ),
  );
  assert.equal(wildcard.error.code, JsonRpcCode.Forbidden);
  assert.equal(calls.length, 0);
});

test("missing tenant is unauthorized and does not call the host", async () => {
  const { host, calls } = createHost();
  const denied = asFailure(await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "ping" }, { tenantId: "  ", scopes: ["forms.list"] }, host));
  assert.equal(denied.error.code, JsonRpcCode.Unauthorized);
  assert.equal(calls.length, 0);
});

test("resources/list and resources/read use tenant form URIs", async () => {
  const seen: { tenantId?: string; formId?: string } = {};
  const { host, calls } = createHost({
    listForms: (tenantId) => {
      seen.tenantId = tenantId;
      return [{ id: "a b", name: "intake", title: "Intake", description: "Public" }];
    },
    getForm: (tenantId, formId) => {
      seen.tenantId = tenantId;
      seen.formId = formId;
      return { id: formId, title: "Intake" };
    },
  });
  const listed = asSuccess(await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "resources/list" }, ctx(), host));
  const resources = (listed.result as { resources: Array<{ uri: string; name: string; title?: string }> }).resources;
  const uri = formResourceUri("ten", "a b");
  assert.equal(resources[0]?.uri, uri);
  assert.equal(resources[0]?.uri, "meridian://tenant/ten/forms/a%20b");
  assert.equal(resources[0]?.name, "intake");
  assert.equal(resources[0]?.title, "Intake");

  const read = asSuccess(
    await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri } }, ctx(), host),
  );
  const contents = (read.result as { contents: Array<{ uri: string; mimeType: string; text: string }> }).contents;
  assert.equal(contents[0]?.uri, uri);
  assert.equal(contents[0]?.mimeType, "application/json");
  assert.deepEqual(JSON.parse(contents[0]?.text ?? ""), { id: "a b", title: "Intake" });
  assert.equal(seen.formId, "a b");
  assert.deepEqual(calls, ["listForms", "getForm"]);
});

test("cross-tenant resource reads are forbidden and do not call getForm", async () => {
  let called = false;
  const { host, calls } = createHost({
    getForm: (_tenantId, formId) => {
      called = true;
      return formId === "missing" ? null : { id: formId };
    },
  });
  const denied = asFailure(
    await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: "r",
        method: "resources/read",
        params: { uri: "meridian://tenant/other/forms/abc?token=super-secret-value" },
      },
      ctx(["forms.get"]),
      host,
    ),
  );
  assert.equal(denied.error.code, JsonRpcCode.Forbidden);
  assert.equal(called, false);
  assert.equal(calls.length, 0);
  assert.equal(JSON.stringify(denied).includes("super-secret-value"), false);

  const missing = asFailure(
    await handleMcpMessage(
      { jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "meridian://tenant/ten/forms/missing" } },
      ctx(),
      host,
    ),
  );
  assert.equal(missing.error.code, JsonRpcCode.NotFound);
  assert.deepEqual(calls, ["getForm"]);
});

test("tool execution errors redact argument secrets and hide the thrown message", async () => {
  const secret = "super-secret-value";
  const { host } = createHost({
    createSubmission: () => {
      throw new Error(`database rejected ${secret}`);
    },
  });
  const failed = asFailure(
    await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "submissions.create",
          arguments: {
            formId: "f",
            password: secret,
            nested: { token: secret, apiKey: secret },
            items: [{ authorization: secret }],
            secret,
            note: "visible",
          },
        },
      },
      ctx(["submissions.create"]),
      host,
    ),
  );
  assert.equal(failed.error.code, JsonRpcCode.InternalError);
  assert.equal(failed.error.message, "Internal error");
  const data = failed.error.data as {
    password: string;
    nested: { token: string; apiKey: string };
    items: Array<{ authorization: string }>;
    secret: string;
    note: string;
  };
  assert.equal(data.password, "***");
  assert.equal(data.nested.token, "***");
  assert.equal(data.nested.apiKey, "***");
  assert.equal(data.items[0]?.authorization, "***");
  assert.equal(data.secret, "***");
  assert.equal(data.note, "visible");
  assert.equal(JSON.stringify(failed).includes(secret), false);
});

test("unknown tools and missing forms do not leak arguments", async () => {
  const { host, calls } = createHost();
  const unknown = asFailure(
    await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "forms.delete", arguments: { token: "super-secret-value" } } },
      ctx(["forms.delete"]),
      host,
    ),
  );
  assert.equal(unknown.error.code, JsonRpcCode.InvalidParams);
  assert.equal(calls.length, 0);
  assert.equal(JSON.stringify(unknown).includes("super-secret-value"), false);

  const missing = asFailure(
    await handleMcpMessage(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "submissions.get", arguments: { id: "gone" } } },
      ctx(["submissions.get"]),
      host,
    ),
  );
  assert.equal(missing.error.code, JsonRpcCode.NotFound);
  assert.deepEqual(calls, ["getSubmission"]);
});

test("invalid JSON-RPC requests", async () => {
  const { host, calls } = createHost();
  const parsed = asFailure(await handleMcpMessage("{", ctx(), host));
  assert.equal(parsed.error.code, JsonRpcCode.ParseError);
  assert.equal(parsed.id, null);
  assert.equal(JSON.stringify(parsed).includes("super-secret-value"), false);

  const secretRaw = '{"jsonrpc":"2.0","id":1,"method":"ping","password":"super-secret-value"';
  const leaked = asFailure(await handleMcpMessage(secretRaw, { tenantId: "", scopes: [] }, host));
  assert.equal(leaked.error.code, JsonRpcCode.ParseError);
  assert.equal(JSON.stringify(leaked).includes("super-secret-value"), false);

  const version = asFailure(await handleMcpMessage({ jsonrpc: "1.0", id: 4, method: "ping" }, ctx(), host));
  assert.equal(version.error.code, JsonRpcCode.InvalidRequest);
  assert.equal(version.id, 4);

  const missingMethod = asFailure(await handleMcpMessage({ jsonrpc: "2.0", id: 5 }, ctx(), host));
  assert.equal(missingMethod.error.code, JsonRpcCode.InvalidRequest);

  const badParams = asFailure(await handleMcpMessage({ jsonrpc: "2.0", id: "x", method: "ping", params: "nope" }, ctx(), host));
  assert.equal(badParams.error.code, JsonRpcCode.InvalidRequest);
  assert.equal(badParams.id, "x");

  const unknown = asFailure(await handleMcpMessage({ jsonrpc: "2.0", id: 6, method: "prompts/list" }, ctx(), host));
  assert.equal(unknown.error.code, JsonRpcCode.MethodNotFound);

  const toolParams = asFailure(
    await handleMcpMessage({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { arguments: {} } }, ctx(["forms.list"]), host),
  );
  assert.equal(toolParams.error.code, JsonRpcCode.InvalidParams);

  const empty = asFailure(await handleMcpMessage([], ctx(), host));
  assert.equal(empty.error.code, JsonRpcCode.InvalidRequest);

  const fromText = asSuccess(await handleMcpMessage('{"jsonrpc":"2.0","id":8,"method":"ping"}', ctx(), host));
  assert.deepEqual(fromText.result, {});
  assert.equal(calls.length, 0);
});

test("batches answer each request and skip notifications", async () => {
  const { host, calls } = createHost({
    listForms: async () => [{ id: "f1", name: "f1" }],
  });
  const batch = await handleMcpMessage(
    [
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "forms.list", arguments: {} } },
      { jsonrpc: "2.0", method: "ping" },
      { id: 3, method: "ping" },
    ],
    ctx(["forms.list"]),
    host,
  );
  assert.ok(Array.isArray(batch));
  assert.deepEqual(
    batch.map((item) => item.id),
    [1, 2, 3],
  );
  assert.deepEqual((batch[0] as JsonRpcSuccess).result, {});
  assert.deepEqual((batch[1] as JsonRpcSuccess).result, {
    content: [{ type: "text", text: JSON.stringify([{ id: "f1", name: "f1" }]) }],
    structuredContent: [{ id: "f1", name: "f1" }],
  });
  assert.equal((batch[2] as JsonRpcFailure).error.code, JsonRpcCode.InvalidRequest);
  assert.deepEqual(calls, ["listForms"]);

  const onlyNotes = await handleMcpMessage([{ jsonrpc: "2.0", method: "notifications/initialized" }], ctx(), host);
  assert.equal(onlyNotes, null);
});
