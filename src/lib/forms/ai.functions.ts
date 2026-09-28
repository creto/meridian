import { createServerFn } from "@tanstack/react-start";
import { generateFormFromText, normalizeAiComponents } from "./generate.ts";
import { newFormShell } from "./importing.ts";
import type { FormDefinition } from "./types.ts";

const SYSTEM = `You design enterprise forms. Return ONLY JSON with this shape:
{"title":"string","description":"string","display":"form"|"wizard","components":[...]}
Component types: textfield, textarea, number, email, phone, url, select, radio, checkbox, toggle, date, datetime, currency, file, signature, address, panel, datagrid, content, review.
Each component has id omitted, type, key (camelCase), label, required boolean, and optional description, placeholder, conditional (safe expression using == and and), values:[{label,value}].
Panels contain components and become wizard pages when display is wizard.
Use conditional rules for fields that depend on answers. Do not include JavaScript. Do not wrap in markdown.`;

export const generateFormWithModel = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => {
    const prompt = input?.prompt?.trim() ?? "";
    if (prompt.length < 8) throw new Error("Describe the form in a bit more detail");
    if (prompt.length > 4000) throw new Error("Description is too long");
    return { prompt };
  })
  .handler(async ({ data }): Promise<{ ok: true; form: FormDefinition; provider: "grok" | "local" } | { ok: false; error: string; form?: FormDefinition } > => {
    const local = () => generateFormFromText(data.prompt);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: true, form: local(), provider: "local" };
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 3500,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: data.prompt },
          ],
        }),
      });
      if (!res.ok) return { ok: true, form: local(), provider: "local" };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) return { ok: true, form: local(), provider: "local" };
      const parsed = JSON.parse(text.slice(start, end + 1)) as { title?: string; description?: string; display?: string; components?: unknown };
      const components = normalizeAiComponents(parsed);
      if (components.length === 0) return { ok: true, form: local(), provider: "local" };
      const form = newFormShell({
        title: parsed.title?.slice(0, 120) || "Generated form",
        description: parsed.description?.slice(0, 400) || data.prompt.slice(0, 280),
        display: parsed.display === "wizard" ? "wizard" : components.every((c) => c.type === "panel") ? "wizard" : "form",
        components,
        source: "grok",
        tags: ["ai"],
        activity: [{ at: new Date().toISOString(), actor: "Grok", message: "Generated from a description" }],
      });
      return { ok: true, form, provider: "grok" };
    } catch {
      return { ok: true, form: local(), provider: "local" };
    }
  });
