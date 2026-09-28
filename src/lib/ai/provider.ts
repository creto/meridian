import { generateFormFromText } from "../forms/generate.ts";

export interface StructuredGenerationRequest<T> {
  system: string;
  prompt: string;
  schemaHint: string;
}

export type StructuredGenerationResult<T> =
  | { ok: true; value: T; provider: string; model: string }
  | { ok: false; error: string; provider: string };

export interface AIProvider {
  name: string;
  generateStructured<T>(req: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}

export function createLocalProvider(): AIProvider {
  return {
    name: "local",
    async healthCheck() {
      return { ok: true, detail: "Local form designer is available" };
    },
    async generateStructured<T>(req: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
      if (req.schemaHint !== "form") {
        return { ok: false, error: "The local provider only designs forms.", provider: "local" };
      }
      return { ok: true, value: generateFormFromText(req.prompt) as T, provider: "local", model: "meridian-local" };
    },
  };
}

interface CompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  name: string;
}

function hasApiKey(apiKey: string | undefined): boolean {
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

function parseJsonObject(content: string): unknown {
  let text = content.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response did not contain a JSON object");
  const value: unknown = JSON.parse(text.slice(start, end + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Model response was not a JSON object");
  return value;
}

function messageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  return "";
}

function createCompatibleProvider(opts: CompatibleOptions): AIProvider {
  const endpoint = `${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    name: opts.name,
    async healthCheck() {
      if (!hasApiKey(opts.apiKey)) return { ok: false, detail: "API key is missing" };
      return { ok: true, detail: `${opts.name} configured for ${opts.model}` };
    },
    async generateStructured<T>(req: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
      if (!hasApiKey(opts.apiKey)) {
        return { ok: false, error: "API key is missing", provider: opts.name };
      }
      const doFetch = opts.fetchImpl ?? fetch;
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: opts.model,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: `${req.prompt}\n\nRespond with one JSON object. Schema hint:\n${req.schemaHint}` },
            ],
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        return { ok: false, error: message, provider: opts.name };
      }
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 400);
        return { ok: false, error: detail || `HTTP ${response.status}`, provider: opts.name };
      }
      try {
        const payload = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
        const content = messageContent(payload.choices?.[0]?.message?.content);
        if (!content) return { ok: false, error: "Empty completion", provider: opts.name };
        return { ok: true, value: parseJsonObject(content) as T, provider: opts.name, model: opts.model };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not parse model JSON";
        return { ok: false, error: message, provider: opts.name };
      }
    },
  };
}

export function createOpenAiCompatibleProvider(opts: { baseUrl: string; apiKey: string; model: string; fetchImpl?: typeof fetch }): AIProvider {
  return createCompatibleProvider({ ...opts, name: "openai-compatible" });
}

export function createGrokProvider(opts: { apiKey?: string; model?: string; fetchImpl?: typeof fetch } = {}): AIProvider {
  return createCompatibleProvider({
    baseUrl: "https://api.x.ai/v1",
    apiKey: opts.apiKey ?? "",
    model: opts.model || "grok-4.5",
    fetchImpl: opts.fetchImpl,
    name: "grok",
  });
}
