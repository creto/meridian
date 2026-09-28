export interface MeridianClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createMeridianClient(options: MeridianClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  async function call(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : `HTTP ${response.status}`);
    return payload;
  }
  return {
    listForms: () => call("GET", "/api/agent/v1/forms"),
    getForm: (name: string) => call("GET", `/api/agent/v1/forms/${encodeURIComponent(name)}`),
    capabilities: (name: string) => call("GET", `/api/agent/v1/forms/${encodeURIComponent(name)}/capabilities`),
    inputSchema: (name: string) => call("GET", `/api/agent/v1/forms/${encodeURIComponent(name)}/input-schema`),
    toolDefinition: (name: string) => call("GET", `/api/agent/v1/forms/${encodeURIComponent(name)}/tool-definition`),
    openApi: (name: string) => call("GET", `/api/agent/v1/forms/${encodeURIComponent(name)}/openapi`),
    validate: (name: string, data: Record<string, unknown>) => call("POST", `/api/agent/v1/forms/${encodeURIComponent(name)}/validate-object`, { data }),
    submit: (name: string, data: Record<string, unknown>, idempotencyKey?: string) =>
      call("POST", `/api/agent/v1/forms/${encodeURIComponent(name)}/submit-object`, { data }, idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined),
    getSubmission: (id: string) => call("GET", `/api/agent/v1/submissions/${encodeURIComponent(id)}`),
  };
}
