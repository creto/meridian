import { formatCurrency, formatDate, formatNumber } from "./format.ts";

export type MessageKey = "save" | "publish" | "required" | "next" | "previous" | "submit" | "draft" | "errors";

const BASE: Record<"en" | "es", Record<MessageKey, string>> = {
  en: { save: "Save", publish: "Publish", required: "Required", next: "Next", previous: "Previous", submit: "Submit", draft: "Save draft", errors: "{count} errors" },
  es: { save: "Guardar", publish: "Publicar", required: "Obligatorio", next: "Siguiente", previous: "Anterior", submit: "Enviar", draft: "Guardar borrador", errors: "{count} errores" },
};

export interface FormMessages {
  locale: string;
  messages: Partial<Record<MessageKey, string>>;
}

/** Per-form strings override the locale catalog. Missing keys fall back to English, then the key. */
export function translate(form: FormMessages | null, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const locale = form?.locale === "es" ? "es" : "en";
  const template = form?.messages[key] ?? BASE[locale][key] ?? BASE.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? ""));
}

export function formatAnswer(locale: string, kind: "date" | "number" | "currency", value: string | number): string {
  if (kind === "date") return formatDate(String(value), locale);
  if (kind === "currency") return formatCurrency(Number(value), locale, locale.startsWith("es") ? "EUR" : "USD");
  return formatNumber(Number(value), locale);
}
