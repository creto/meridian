import { createServerFn } from "@tanstack/react-start";
import { proposeEdit } from "./assistant.ts";
import { generateFormFromText, normalizeAiComponents } from "./generate.ts";
import {
  actionsFromModel,
  AGENT_SYSTEM,
  compactComponents,
  CREATE_SYSTEM,
  EDIT_SYSTEM,
  extractJson,
  formFromModel,
  localAgent,
  modelCatalog,
  normalizeOperations,
  sanitizeTree,
  type AgentAction,
  type ModelForm,
  type ModelOperation,
} from "./llm.ts";
import type { FormComponent, FormDefinition, WorkflowDef } from "./types.ts";

const hits: number[] = [];

function allowAi(): boolean {
  const now = Date.now();
  while (hits.length && hits[0] != null && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 20) return false;
  hits.push(now);
  return true;
}

async function grokJson(system: string, user: string, maxTokens: number): Promise<{ ok: true; value: unknown } | { ok: false; error: string; code?: "NO_KEY" }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Grok is not available in this workspace.", code: "NO_KEY" };
  if (!allowAi()) return { ok: false, error: "Too many AI requests this minute. Wait a moment and try again." };

  const once = async (extra: string) => {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(50_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user + extra },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `Grok returned ${res.status}. Try again.` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
  };

  try {
    const first = await once("");
    if (!first.ok) return first;
    const parsed = extractJson(first.text);
    if (parsed && typeof parsed === "object") return { ok: true, value: parsed };
    if (!allowAi()) return { ok: false, error: "Grok's reply was not usable JSON." };
    const second = await once("\n\nReply with one JSON object only.");
    if (!second.ok) return second;
    const retry = extractJson(second.text);
    if (retry && typeof retry === "object") return { ok: true, value: retry };
    return { ok: false, error: "Grok's reply was not usable JSON." };
  } catch {
    return { ok: false, error: "Grok didn't respond. Try again." };
  }
}

export interface EditModelResult {
  ok: true;
  provider: "grok" | "local";
  reply: string;
  summary: string[];
  notes: string[];
  display?: "form" | "wizard";
  title?: string;
  description?: string;
  operations?: ModelOperation[];
  components?: FormComponent[];
  workflow?: WorkflowDef;
}

export const generateFormWithModel = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => {
    const prompt = input?.prompt?.trim() ?? "";
    if (prompt.length < 8) throw new Error("Describe the form in a bit more detail");
    if (prompt.length > 4000) throw new Error("Description is too long");
    return { prompt };
  })
  .handler(async ({ data }): Promise<{ ok: true; form: FormDefinition; provider: "grok" | "local"; reply: string; notice?: string } | { ok: false; error: string }> => {
    const grok = await grokJson(CREATE_SYSTEM, data.prompt, 4500);
    if (grok.ok) {
      const form = formFromModel(data.prompt, grok.value);
      if (form) {
        const value = grok.value as Record<string, unknown>;
        const reply = typeof value.reply === "string" ? value.reply.trim().slice(0, 800) : "";
        return { ok: true, form, provider: "grok", reply };
      }
    }
    if (!grok.ok && grok.code !== "NO_KEY" && grok.error.startsWith("Too many")) return { ok: false, error: grok.error };
    const notice = grok.ok ? "Grok's draft could not be read, so the on-device designer was used." : grok.code === "NO_KEY" ? "Grok is not available, so the on-device designer was used." : `${grok.error} The on-device designer was used instead.`;
    const form = generateFormFromText(data.prompt);
    return { ok: true, form, provider: "local", notice, reply: notice };
  });

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const editFormWithModel = createServerFn({ method: "POST" })
  .validator((input: { instruction: string; history?: ChatTurn[]; form: Pick<FormDefinition, "id" | "title" | "description" | "display" | "components" | "workflow"> }) => {
    const instruction = input?.instruction?.trim() ?? "";
    if (instruction.length < 3) throw new Error("Say what should change");
    if (instruction.length > 2000) throw new Error("Instruction is too long");
    if (!input?.form?.components || !Array.isArray(input.form.components)) throw new Error("Form is missing");
    if (JSON.stringify(input.form.components).length > 80_000) throw new Error("This form is too large to send");
    const history = (input?.history ?? [])
      .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content.slice(0, 1500) }));
    return { instruction, history, form: input.form };
  })
  .handler(async ({ data }): Promise<EditModelResult | { ok: false; error: string }> => {
    const local = (): EditModelResult => {
      const proposal = proposeEdit(data.form as FormDefinition, data.instruction);
      const next = proposal.apply(data.form as FormDefinition);
      return {
        ok: true,
        provider: "local",
        reply: proposal.valid ? proposal.summary.join(". ") : proposal.issues.join(" "),
        summary: proposal.summary,
        notes: proposal.issues,
        display: next.display,
        title: next.title,
        description: next.description,
        components: next.components,
        workflow: next.workflow,
      };
    };
    const prior = data.history.length
      ? `Conversation:\n${data.history.map((item) => `${item.role}: ${item.content}`).join("\n\n")}\n\n`
      : "";
    const grok = await grokJson(
      EDIT_SYSTEM,
      `${prior}Instruction:\n${data.instruction}\n\nCurrent form:\n${JSON.stringify({
        title: data.form.title,
        description: data.form.description,
        display: data.form.display,
        components: compactComponents(data.form.components),
        workflow: data.form.workflow ?? null,
      })}`,
      3500,
    );
    if (!grok.ok) {
      if (grok.code === "NO_KEY") return local();
      return { ok: false, error: grok.error };
    }
    const value = grok.value as Record<string, unknown>;
    const hasWork = (Array.isArray(value.operations) && value.operations.length > 0) || (Array.isArray(value.components) && value.components.length > 0) || value.workflow || value.display;
    if (!hasWork) {
      return {
        ok: true,
        provider: "grok",
        reply: typeof value.reply === "string" ? value.reply.slice(0, 2000) : "Tell me which field to change.",
        summary: [],
        notes: [],
      };
    }
    const operations = Array.isArray(value.operations) && value.operations.length ? normalizeOperations(value.operations) : undefined;
    const replaced = !operations && Array.isArray(value.components) && value.components.length
      ? sanitizeTree(normalizeAiComponents({ components: value.components })).components
      : undefined;
    return {
      ok: true,
      provider: "grok",
      reply: typeof value.reply === "string" ? value.reply.slice(0, 2000) : "",
      summary: Array.isArray(value.summary) ? value.summary.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
      notes: Array.isArray(value.notes) ? value.notes.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      display: value.display === "form" || value.display === "wizard" ? value.display : undefined,
      title: typeof value.title === "string" ? value.title : undefined,
      description: typeof value.description === "string" ? value.description : undefined,
      operations,
      components: replaced,
      workflow: value.workflow && typeof value.workflow === "object" ? (value.workflow as WorkflowDef) : undefined,
    };
  });

export const agentChat = createServerFn({ method: "POST" })
  .validator((input: { messages: ChatTurn[]; forms: FormDefinition[] }) => {
    const messages = (input?.messages ?? []).filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").slice(-8).map((item) => ({
      role: item.role,
      content: item.content.slice(0, 4000),
    }));
    if (!messages.some((item) => item.role === "user" && item.content.trim().length > 1)) throw new Error("Say what you want done");
    const forms = Array.isArray(input?.forms) ? input.forms.slice(0, 12) : [];
    return { messages, forms };
  })
  .handler(async ({ data }): Promise<{ ok: true; provider: "grok" | "local"; reply: string; actions: AgentAction[] } | { ok: false; error: string }> => {
    const last = [...data.messages].reverse().find((item) => item.role === "user")?.content ?? "";
    const catalog: ModelForm[] = modelCatalog(data.forms);
    const grok = await grokJson(
      AGENT_SYSTEM,
      `Forms:\n${JSON.stringify(catalog)}\n\nConversation:\n${data.messages.map((item) => `${item.role}: ${item.content}`).join("\n\n")}`,
      4000,
    );
    if (!grok.ok) {
      if (grok.code === "NO_KEY") {
        const local = localAgent(last, data.forms);
        return { ok: true, provider: "local", reply: local.reply, actions: local.actions };
      }
      return { ok: false, error: grok.error };
    }
    const turned = actionsFromModel(grok.value, last);
    return { ok: true, provider: "grok", reply: turned.reply, actions: turned.actions };
  });
