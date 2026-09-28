export type EmbedMode = "create" | "edit" | "readonly";

export interface EmbedSession {
  formId: string;
  mode: EmbedMode;
  locale: string;
  data: Record<string, unknown>;
  errors: Record<string, string>;
  submitted: boolean;
  lastSubmitted: Record<string, unknown> | null;
  initialData: Record<string, unknown>;
}

export type EmbedEvent =
  | { type: "set-data"; data: Record<string, unknown> }
  | { type: "set-field"; field: string; value: unknown }
  | { type: "set-mode"; mode: EmbedMode }
  | { type: "set-locale"; locale: string }
  | { type: "set-errors"; errors: Record<string, string> }
  | { type: "submit" }
  | { type: "reset" };

export interface EmbedAttributeInput {
  formId: string;
  mode: EmbedMode;
  locale: string;
  theme?: string;
}

export interface EmbedAttributes {
  formId?: string;
  mode?: EmbedMode;
  locale?: string;
  theme?: string;
}

export const EMBED_ATTRIBUTE_NAMES = {
  formId: "data-form-id",
  mode: "data-mode",
  locale: "data-locale",
  theme: "data-theme",
} as const;

const MODES = new Set<EmbedMode>(["create", "edit", "readonly"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMode(value: unknown): value is EmbedMode {
  return value === "create" || value === "edit" || value === "readonly";
}

function cloneData(data: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(data);
}

function asData(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return cloneData(value);
}

function copyErrors(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(errors)) return out;
  for (const [key, value] of Object.entries(errors)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function createEmbedSession(input: {
  formId: string;
  mode: EmbedMode;
  locale: string;
  data: Record<string, unknown>;
}): EmbedSession {
  const mode = isMode(input.mode) ? input.mode : "create";
  const initialData = asData(input.data);
  return {
    formId: input.formId,
    mode,
    locale: input.locale,
    data: cloneData(initialData),
    errors: {},
    submitted: false,
    lastSubmitted: null,
    initialData,
  };
}

export function reduceEmbed(session: EmbedSession, event: EmbedEvent): EmbedSession {
  switch (event.type) {
    case "set-data": {
      if (session.mode === "readonly") return session;
      return { ...session, data: asData(event.data) };
    }
    case "set-field": {
      if (session.mode === "readonly") return session;
      return { ...session, data: { ...session.data, [event.field]: event.value } };
    }
    case "set-mode": {
      if (!MODES.has(event.mode)) return session;
      return { ...session, mode: event.mode };
    }
    case "set-locale":
      return { ...session, locale: event.locale };
    case "set-errors":
      return { ...session, errors: copyErrors(event.errors) };
    case "submit":
      return { ...session, submitted: true, lastSubmitted: cloneData(session.data) };
    case "reset":
      return {
        ...session,
        data: cloneData(session.initialData),
        errors: {},
        submitted: false,
        lastSubmitted: null,
      };
    default: {
      const _unexpected: never = event;
      void _unexpected;
      return session;
    }
  }
}

export function attributeMap(input: EmbedAttributeInput): Record<string, string> {
  const attrs: Record<string, string> = {
    [EMBED_ATTRIBUTE_NAMES.formId]: input.formId,
    [EMBED_ATTRIBUTE_NAMES.mode]: input.mode,
    [EMBED_ATTRIBUTE_NAMES.locale]: input.locale,
  };
  if (input.theme !== undefined) attrs[EMBED_ATTRIBUTE_NAMES.theme] = input.theme;
  return attrs;
}

export function parseAttributes(record: Readonly<Record<string, string | null | undefined>>): EmbedAttributes {
  const formId = record[EMBED_ATTRIBUTE_NAMES.formId];
  const mode = record[EMBED_ATTRIBUTE_NAMES.mode];
  const locale = record[EMBED_ATTRIBUTE_NAMES.locale];
  const theme = record[EMBED_ATTRIBUTE_NAMES.theme];
  const out: EmbedAttributes = {};
  if (typeof formId === "string") out.formId = formId;
  if (isMode(mode)) out.mode = mode;
  if (typeof locale === "string") out.locale = locale;
  if (typeof theme === "string") out.theme = theme;
  return out;
}
