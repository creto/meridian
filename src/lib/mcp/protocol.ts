/** JSON-RPC 2.0 MCP handler. Host methods are injected so this module never touches a database. */

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_NAME = "meridian";
export const MCP_SERVER_VERSION = "0.9.0";

export const JsonRpcCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  Unauthorized: -32001,
  Forbidden: -32002,
  NotFound: -32004,
} as const;

export type JsonRpcId = string | number | null;

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export interface McpContext {
  tenantId: string;
  scopes: readonly string[];
}

export interface McpFormSummary {
  id: string;
  name?: string;
  title?: string;
  description?: string;
}

type MaybePromise<T> = T | Promise<T>;

export interface McpHost {
  listForms(tenantId: string): MaybePromise<readonly McpFormSummary[]>;
  getForm(tenantId: string, formId: string): MaybePromise<unknown>;
  generateForm(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  validateSubmission(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  createSubmission(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  getSubmission(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  searchSubmissions(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  updateSubmission(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  startWorkflow(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  getWorkflow(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  getJob(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
  uploadFile(tenantId: string, args: Record<string, unknown>): MaybePromise<unknown>;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export const MCP_TOOL_NAMES = [
  "forms.list",
  "forms.get",
  "forms.generate",
  "forms.validate",
  "submissions.create",
  "submissions.get",
  "submissions.search",
  "submissions.update",
  "workflows.start",
  "workflows.get",
  "jobs.get",
  "files.upload",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

const TOOL_NAME_SET = new Set<string>(MCP_TOOL_NAMES);

function prop(type: string, description: string): { type: string; description: string } {
  return { type, description };
}

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "forms.list",
    description: "List forms in the current tenant.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "forms.get",
    description: "Read one form by id.",
    inputSchema: {
      type: "object",
      properties: { id: prop("string", "Form id.") },
      required: ["id"],
    },
  },
  {
    name: "forms.generate",
    description: "Generate a form from a natural-language prompt.",
    inputSchema: {
      type: "object",
      properties: { prompt: prop("string", "Description of the form to draft.") },
      required: ["prompt"],
    },
  },
  {
    name: "forms.validate",
    description: "Validate an object against a form.",
    inputSchema: {
      type: "object",
      properties: {
        formId: prop("string", "Form id."),
        data: prop("object", "Object to validate."),
      },
      required: ["formId", "data"],
    },
  },
  {
    name: "submissions.create",
    description: "Create a submission.",
    inputSchema: {
      type: "object",
      properties: {
        formId: prop("string", "Form id."),
        data: prop("object", "Submission data."),
        idempotencyKey: prop("string", "Idempotency key."),
      },
      required: ["formId", "data"],
    },
  },
  {
    name: "submissions.get",
    description: "Read a submission by id.",
    inputSchema: {
      type: "object",
      properties: { id: prop("string", "Submission id.") },
      required: ["id"],
    },
  },
  {
    name: "submissions.search",
    description: "Search submissions.",
    inputSchema: {
      type: "object",
      properties: {
        formId: prop("string", "Optional form id."),
        query: prop("string", "Search text."),
        limit: prop("number", "Maximum rows."),
      },
    },
  },
  {
    name: "submissions.update",
    description: "Update a submission.",
    inputSchema: {
      type: "object",
      properties: {
        id: prop("string", "Submission id."),
        data: prop("object", "Replacement data."),
      },
      required: ["id", "data"],
    },
  },
  {
    name: "workflows.start",
    description: "Start a workflow.",
    inputSchema: {
      type: "object",
      properties: {
        id: prop("string", "Workflow id."),
        body: prop("object", "Start payload."),
      },
      required: ["id"],
    },
  },
  {
    name: "workflows.get",
    description: "Read a workflow instance.",
    inputSchema: {
      type: "object",
      properties: { id: prop("string", "Workflow instance id.") },
      required: ["id"],
    },
  },
  {
    name: "jobs.get",
    description: "Read a background job.",
    inputSchema: {
      type: "object",
      properties: { id: prop("string", "Job id.") },
      required: ["id"],
    },
  },
  {
    name: "files.upload",
    description: "Upload a file.",
    inputSchema: {
      type: "object",
      properties: {
        name: prop("string", "File name."),
        contentType: prop("string", "MIME type."),
        data: prop("string", "File bytes or reference."),
      },
      required: ["name"],
    },
  },
];

const SECRET_KEYS = new Set(["secret", "password", "token", "apikey", "authorization"]);

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase());
}

/** Replace secret, password, token, apiKey, and authorization values with "***". */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return [];
    seen.add(value);
    return value.map((item) => redact(item, seen));
  }
  if (!isRecord(value)) return value;
  if (seen.has(value)) return {};
  seen.add(value);
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSecretKey(key) ? "***" : redact(inner, seen);
  }
  return out;
}

export function formResourceUri(tenantId: string, formId: string): string {
  return `meridian://tenant/${encodeURIComponent(tenantId)}/forms/${encodeURIComponent(formId)}`;
}

class ToolFailure extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "ToolFailure";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  if (value === null) return true;
  if (typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isStructuredParams(value: unknown): value is Record<string, unknown> | unknown[] {
  return Array.isArray(value) || isRecord(value);
}

function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcFailure {
  const error: JsonRpcErrorBody = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

function hasTenant(ctx: McpContext | null | undefined): ctx is McpContext {
  return !!ctx && typeof ctx === "object" && typeof ctx.tenantId === "string" && ctx.tenantId.trim().length > 0;
}

function jsonText(value: unknown): string {
  if (value === undefined) return "null";
  try {
    const text = JSON.stringify(value);
    return typeof text === "string" ? text : "null";
  } catch {
    return "null";
  }
}

function isToolName(value: string): value is McpToolName {
  return TOOL_NAME_SET.has(value);
}

function firstString(args: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

interface ParsedUri {
  tenantId: string;
  formId: string | null;
}

function parseMeridianUri(uri: string): ParsedUri | null {
  const match = /^meridian:\/\/tenant\/([^/?#]+)([^?#]*)/.exec(uri);
  if (!match?.[1]) return null;
  let tenantId: string;
  try {
    tenantId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const path = match[2] ?? "";
  const formMatch = /^\/forms\/([^/]+)$/.exec(path);
  if (!formMatch?.[1]) return { tenantId, formId: null };
  try {
    const formId = decodeURIComponent(formMatch[1]);
    if (!formId) return { tenantId, formId: null };
    return { tenantId, formId };
  } catch {
    return { tenantId, formId: null };
  }
}

function toolResult(value: unknown): unknown {
  return {
    content: [{ type: "text", text: jsonText(value) }],
    structuredContent: value,
  };
}

async function invokeTool(name: McpToolName, args: Record<string, unknown>, ctx: McpContext, host: McpHost): Promise<unknown> {
  const asked = firstString(args, ["tenantId", "tenant"]);
  if (asked && asked !== ctx.tenantId) throw new ToolFailure(JsonRpcCode.Forbidden, "wrong-tenant");
  const tenantId = ctx.tenantId;
  switch (name) {
    case "forms.list":
      return host.listForms(tenantId);
    case "forms.get": {
      const formId = firstString(args, ["id", "formId", "name"]);
      if (!formId) throw new ToolFailure(JsonRpcCode.InvalidParams, "Invalid params");
      const form = await host.getForm(tenantId, formId);
      if (form == null) throw new ToolFailure(JsonRpcCode.NotFound, "Not found");
      return form;
    }
    case "forms.generate":
      return host.generateForm(tenantId, args);
    case "forms.validate":
      return host.validateSubmission(tenantId, args);
    case "submissions.create":
      return host.createSubmission(tenantId, args);
    case "submissions.get":
      return requiredValue(await host.getSubmission(tenantId, args));
    case "submissions.search":
      return host.searchSubmissions(tenantId, args);
    case "submissions.update":
      return host.updateSubmission(tenantId, args);
    case "workflows.start":
      return host.startWorkflow(tenantId, args);
    case "workflows.get":
      return requiredValue(await host.getWorkflow(tenantId, args));
    case "jobs.get":
      return requiredValue(await host.getJob(tenantId, args));
    case "files.upload":
      return host.uploadFile(tenantId, args);
    default: {
      const _unexpected: never = name;
      void _unexpected;
      throw new ToolFailure(JsonRpcCode.InvalidParams, "Invalid params");
    }
  }
}

function requiredValue(value: unknown): unknown {
  if (value == null) throw new ToolFailure(JsonRpcCode.NotFound, "Not found");
  return value;
}

async function callTool(
  params: Record<string, unknown> | unknown[] | undefined,
  id: JsonRpcId,
  ctx: McpContext,
  host: McpHost,
): Promise<JsonRpcResponse> {
  if (!isRecord(params) || typeof params.name !== "string" || params.name.length === 0) {
    return failure(id, JsonRpcCode.InvalidParams, "Invalid params");
  }
  if (!isToolName(params.name)) return failure(id, JsonRpcCode.InvalidParams, "Invalid params");
  if (hasOwn(params, "arguments") && !isRecord(params.arguments)) {
    return failure(id, JsonRpcCode.InvalidParams, "Invalid params");
  }
  const args = isRecord(params.arguments) ? params.arguments : {};
  const scopes = Array.isArray(ctx.scopes) ? ctx.scopes : [];
  if (!scopes.includes(params.name)) return failure(id, JsonRpcCode.Forbidden, "Forbidden");
  try {
    const value = await invokeTool(params.name, args, ctx, host);
    return success(id, toolResult(value));
  } catch (error) {
    if (error instanceof ToolFailure) return failure(id, error.code, error.message);
    return failure(id, JsonRpcCode.InternalError, "Internal error", redact(args));
  }
}

async function listResources(id: JsonRpcId, ctx: McpContext, host: McpHost): Promise<JsonRpcResponse> {
  try {
    const forms = await host.listForms(ctx.tenantId);
    if (!Array.isArray(forms)) return failure(id, JsonRpcCode.InternalError, "Internal error");
    const resources: Array<{ uri: string; name: string; mimeType: "application/json"; title?: string; description?: string }> = [];
    for (const form of forms) {
      if (!isRecord(form) || typeof form.id !== "string" || form.id.length === 0) continue;
      const name =
        typeof form.name === "string" && form.name.length > 0
          ? form.name
          : typeof form.title === "string" && form.title.length > 0
            ? form.title
            : form.id;
      const resource: { uri: string; name: string; mimeType: "application/json"; title?: string; description?: string } = {
        uri: formResourceUri(ctx.tenantId, form.id),
        name,
        mimeType: "application/json",
      };
      if (typeof form.title === "string") resource.title = form.title;
      if (typeof form.description === "string") resource.description = form.description;
      resources.push(resource);
    }
    return success(id, { resources });
  } catch {
    return failure(id, JsonRpcCode.InternalError, "Internal error");
  }
}

async function readResource(
  params: Record<string, unknown> | unknown[] | undefined,
  id: JsonRpcId,
  ctx: McpContext,
  host: McpHost,
): Promise<JsonRpcResponse> {
  if (!isRecord(params) || typeof params.uri !== "string" || params.uri.length === 0) {
    return failure(id, JsonRpcCode.InvalidParams, "Invalid params");
  }
  const parsed = parseMeridianUri(params.uri);
  if (!parsed) return failure(id, JsonRpcCode.InvalidParams, "Invalid params");
  if (parsed.tenantId !== ctx.tenantId) return failure(id, JsonRpcCode.Forbidden, "Forbidden");
  if (!parsed.formId) return failure(id, JsonRpcCode.NotFound, "Not found");
  try {
    const form = await host.getForm(ctx.tenantId, parsed.formId);
    if (form == null) return failure(id, JsonRpcCode.NotFound, "Not found");
    const uri = formResourceUri(ctx.tenantId, parsed.formId);
    return success(id, {
      contents: [{ uri, mimeType: "application/json", text: jsonText(form) }],
    });
  } catch {
    return failure(id, JsonRpcCode.InternalError, "Internal error");
  }
}

async function route(
  method: string,
  params: Record<string, unknown> | unknown[] | undefined,
  id: JsonRpcId,
  ctx: McpContext,
  host: McpHost,
): Promise<JsonRpcResponse> {
  switch (method) {
    case "initialize":
      return success(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        capabilities: { tools: {}, resources: {} },
      });
    case "ping":
      return success(id, {});
    case "notifications/initialized":
      return success(id, {});
    case "tools/list":
      return success(id, { tools: [...MCP_TOOLS] });
    case "tools/call":
      return callTool(params, id, ctx, host);
    case "resources/list":
      return listResources(id, ctx, host);
    case "resources/read":
      return readResource(params, id, ctx, host);
    default:
      return failure(id, JsonRpcCode.MethodNotFound, "Method not found");
  }
}

async function dispatch(message: unknown, ctx: McpContext, host: McpHost): Promise<JsonRpcResponse | null> {
  if (!isRecord(message)) return failure(null, JsonRpcCode.InvalidRequest, "Invalid Request");
  const idPresent = hasOwn(message, "id");
  const id = idPresent && isJsonRpcId(message.id) ? message.id : null;
  const paramsPresent = hasOwn(message, "params");
  const versionOk = message.jsonrpc === "2.0";
  const method = message.method;
  const methodOk = typeof method === "string" && method.length > 0;
  const paramsOk = !paramsPresent || isStructuredParams(message.params);
  const idOk = !idPresent || isJsonRpcId(message.id);
  if (!versionOk || !methodOk || !paramsOk || !idOk) {
    return failure(id, JsonRpcCode.InvalidRequest, "Invalid Request");
  }
  if (!idPresent) return null;
  if (!hasTenant(ctx)) return failure(id, JsonRpcCode.Unauthorized, "Unauthorized");
  const params = paramsPresent && isStructuredParams(message.params) ? message.params : undefined;
  return route(method, params, id, ctx, host);
}

function decodeRaw(raw: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof raw !== "string") return { ok: true, value: raw };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** Handle one JSON-RPC message or a batch. Notifications are omitted from the response. */
export async function handleMcpMessage(
  raw: unknown,
  ctx: McpContext,
  host: McpHost,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  try {
    const decoded = decodeRaw(raw);
    if (!decoded.ok) return failure(null, JsonRpcCode.ParseError, "Parse error");
    if (Array.isArray(decoded.value)) {
      if (decoded.value.length === 0) return failure(null, JsonRpcCode.InvalidRequest, "Invalid Request");
      const responses: JsonRpcResponse[] = [];
      for (const item of decoded.value) {
        try {
          const response = await dispatch(item, ctx, host);
          if (response) responses.push(response);
        } catch {
          responses.push(failure(null, JsonRpcCode.InternalError, "Internal error"));
        }
      }
      return responses.length > 0 ? responses : null;
    }
    return await dispatch(decoded.value, ctx, host);
  } catch {
    return failure(null, JsonRpcCode.InternalError, "Internal error");
  }
}
