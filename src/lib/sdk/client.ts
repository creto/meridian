export interface MeridianClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class MeridianError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "MeridianError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorCode(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function errorFromResponse(status: number, text: string): MeridianError {
  if (text.length === 0) return new MeridianError(status, "HTTP_ERROR", `HTTP ${status}`);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new MeridianError(status, "HTTP_ERROR", text);
  }
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const code = error ? errorCode(error.code) : null;
  const message = error && typeof error.message === "string" && error.message.length > 0 ? error.message : `HTTP ${status}`;
  const details = error && "details" in error ? error.details : undefined;
  return new MeridianError(status, code ?? "HTTP_ERROR", message, details);
}

export class MeridianClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MeridianClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  listForms<T = unknown>(): Promise<T> {
    return this.request<T>("GET", "/api/agent/v1/forms");
  }

  getForm<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/forms/${encodeURIComponent(id)}`);
  }

  formCapabilities<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/forms/${encodeURIComponent(id)}/capabilities`);
  }

  formInputSchema<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/forms/${encodeURIComponent(id)}/input-schema`);
  }

  formToolDefinition<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/forms/${encodeURIComponent(id)}/tool-definition`);
  }

  formOpenApi<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/forms/${encodeURIComponent(id)}/openapi`);
  }

  generateForm<T = unknown>(prompt: string): Promise<T> {
    return this.request<T>("POST", "/api/agent/v1/forms/generate", { prompt });
  }

  validateObject<T = unknown>(formId: string, data: unknown): Promise<T> {
    return this.request<T>("POST", `/api/agent/v1/forms/${encodeURIComponent(formId)}/validate-object`, { data });
  }

  submitObject<T = unknown>(formId: string, data: unknown, opts?: { idempotencyKey?: string }): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    return this.request<T>("POST", `/api/agent/v1/forms/${encodeURIComponent(formId)}/submit-object`, { data }, headers);
  }

  getSubmission<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/submissions/${encodeURIComponent(id)}`);
  }

  patchSubmission<T = unknown>(id: string, data: unknown): Promise<T> {
    return this.request<T>("PATCH", `/api/agent/v1/submissions/${encodeURIComponent(id)}`, { data });
  }

  startWorkflow<T = unknown>(id: string, body: unknown): Promise<T> {
    return this.request<T>("POST", `/api/agent/v1/workflows/${encodeURIComponent(id)}/start`, body === undefined ? {} : body);
  }

  getWorkflowInstance<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/workflows/instances/${encodeURIComponent(id)}`);
  }

  getJob<T = unknown>(id: string): Promise<T> {
    return this.request<T>("GET", `/api/agent/v1/jobs/${encodeURIComponent(id)}`);
  }

  retryJob<T = unknown>(id: string): Promise<T> {
    return this.request<T>("POST", `/api/agent/v1/jobs/${encodeURIComponent(id)}/retry`);
  }

  cancelJob<T = unknown>(id: string): Promise<T> {
    return this.request<T>("POST", `/api/agent/v1/jobs/${encodeURIComponent(id)}/cancel`);
  }

  uploadFile<T = unknown>(meta: unknown): Promise<T> {
    return this.request<T>("POST", "/api/agent/v1/files", meta === undefined ? {} : meta);
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...extraHeaders,
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    const text = await response.text();
    if (!response.ok) throw errorFromResponse(response.status, text);
    if (text.length === 0) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new MeridianError(response.status, "INVALID_RESPONSE", "Response was not valid JSON");
    }
  }
}
