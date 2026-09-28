export interface ApiOperation {
  id: string;
  group: "overview" | "auth" | "clients" | "openapi" | "schemas" | "agent" | "mcp" | "webhooks" | "sdks" | "examples" | "errors" | "limits";
  method: "GET" | "POST" | "PATCH";
  path: string;
  summary: string;
  auth: string;
  body?: unknown;
  tryable: boolean;
}

export const OPERATIONS: ApiOperation[] = [
  { id: "health", group: "overview", method: "GET", path: "/api/agent/v1/health/live", summary: "Process liveness.", auth: "none", tryable: true },
  { id: "forms", group: "agent", method: "GET", path: "/api/agent/v1/forms", summary: "List forms in the synced workspace.", auth: "api key or session", tryable: true },
  { id: "validate", group: "agent", method: "POST", path: "/api/agent/v1/forms/{name}/validate-object", summary: "Validate a submission object against the published form.", auth: "api key", tryable: false, body: { data: {} } },
  { id: "submit", group: "agent", method: "POST", path: "/api/agent/v1/forms/{name}/submit-object", summary: "Submit through the server command path.", auth: "api key", tryable: false, body: { data: {} } },
  { id: "mcp", group: "mcp", method: "GET", path: "/api/agent/v1/mcp/tools", summary: "Tool definitions served by the same API process.", auth: "api key", tryable: true },
  { id: "openapi-form", group: "openapi", method: "GET", path: "/api/agent/v1/forms/{name}/openapi", summary: "OpenAPI document for one form.", auth: "api key", tryable: false },
  { id: "platform-publication", group: "auth", method: "POST", path: "/api/platform/publication/check", summary: "Publication mode decision.", auth: "none", tryable: true, body: { policy: { mode: "AUTHENTICATED", submissionsSoFar: 0, oneSubmissionPerToken: false, usedTokens: [], allowedEmbedDomains: [], allowedOrigins: [], hasSession: false, viaApi: false } } },
  { id: "platform-connectors", group: "overview", method: "GET", path: "/api/platform/connectors", summary: "Connector capability matrix.", auth: "none", tryable: true },
  { id: "admin-console", group: "overview", method: "GET", path: "/api/admin/console", summary: "Tenant directory, jobs, and audit from Postgres.", auth: "same origin", tryable: true },
  { id: "webhooks", group: "webhooks", method: "POST", path: "/api/hooks/deliver", summary: "Signed webhook delivery.", auth: "secret", tryable: false },
];

export const GROUPS: ApiOperation["group"][] = ["overview", "auth", "clients", "openapi", "schemas", "agent", "mcp", "webhooks", "sdks", "examples", "errors", "limits"];

export const ERRORS = [
  { code: "BAD_REQUEST", status: 400, meaning: "The JSON body is missing a required field." },
  { code: "AUTH", status: 401, meaning: "The publication mode requires a session, or the prefill signature failed." },
  { code: "ABAC", status: 403, meaning: "A contextual policy rejected the subject." },
  { code: "STALE", status: 409, meaning: "The builder revision is older than the saved head." },
  { code: "NOT_FOUND", status: 404, meaning: "No route or record matches." },
  { code: "LOOKUP", status: 422, meaning: "The data source refused the URL or returned an error." },
];

export const LIMITS = [
  { name: "agent", window: "60s", limit: "120 requests per api key" },
  { name: "public fill", window: "60s", limit: "30 requests per address" },
  { name: "export", window: "job", limit: "500 rows per page, further pages by cursor" },
];

export const SDK_NOTES = [
  { name: "TypeScript", path: "src/sdk/client.ts", note: "createMeridianClient calls the agent routes. Idempotency-Key is the retry key." },
  { name: "Angular", path: "packages/angular", note: "Renderer, wizard, inbox, and PDF editor view models. They do not import @angular/core in this repo." },
  { name: "Web component", path: "packages/web-component/meridian-form.js", note: "meridian-form loads a form and posts a submission to the agent API." },
];

export function operationById(id: string): ApiOperation | undefined {
  return OPERATIONS.find((item) => item.id === id);
}

export function substitute(path: string, params: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (_match, key: string) => encodeURIComponent(params[key] ?? key));
}
