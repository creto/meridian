import { createComponent } from "./catalog.ts";
import { uid, uniqueKey, slugKey } from "./ids.ts";
import type { FormComponent, FormDefinition } from "./types.ts";

export interface ColumnProfile {
  field: string;
  key: string;
  count: number;
  nullCount: number;
  uniqueCount: number;
  inferredType: FormComponent["type"];
  confidence: number;
  examples: string[];
  enumCandidate: boolean;
  options?: { label: string; value: string }[];
  min?: string;
  max?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL = /^https?:\/\/\S+$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[+()\d][\d\s().-]{6,}$/;
const INT = /^-?\d+$/;
const NUM = /^-?\d+(\.\d+)?$/;
const MONEY = /^[$€£]\s?-?\d/;

function inferCell(value: string): string {
  const v = value.trim();
  if (!v) return "empty";
  if (EMAIL.test(v)) return "email";
  if (URL.test(v)) return "url";
  if (DATE.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return "date";
  if (MONEY.test(v)) return "currency";
  if (PHONE.test(v) && /[+\-().\s]/.test(v) && !INT.test(v.replace(/\s/g, ""))) return "phone";
  if (INT.test(v) || NUM.test(v)) return "number";
  if (v.length > 80) return "textarea";
  return "textfield";
}

export function profileColumns(rows: Record<string, string>[]): ColumnProfile[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  return headers.map((field) => {
    const values = rows.map((row) => String(row[field] ?? "").trim());
    const present = values.filter((v) => v !== "");
    const kinds = new Map<string, number>();
    for (const value of present) {
      const kind = inferCell(value);
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    let inferred: FormComponent["type"] = "textfield";
    let best = 0;
    for (const [kind, count] of kinds) {
      if (count > best) {
        best = count;
        inferred = kind === "empty" ? "textfield" : (kind as FormComponent["type"]);
      }
    }
    const unique = new Set(present.map((v) => v.toLowerCase()));
    const enumCandidate = present.length >= 4 && unique.size > 1 && unique.size <= 8 && unique.size <= Math.ceil(present.length * 0.5) && inferred === "textfield";
    if (enumCandidate) inferred = "select";
    const confidence = present.length === 0 ? 0.4 : Math.min(0.98, 0.55 + best / present.length * 0.4);
    const sorted = [...present].sort();
    return {
      field,
      key: slugKey(field),
      count: values.length,
      nullCount: values.length - present.length,
      uniqueCount: unique.size,
      inferredType: inferred,
      confidence: Number(confidence.toFixed(2)),
      examples: present.slice(0, 3),
      enumCandidate,
      options: enumCandidate ? [...unique].slice(0, 12).map((value) => ({ label: value, value: slugKey(value, "option") })) : undefined,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  });
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      pushCell();
      pushRow();
      continue;
    }
    cell += ch;
  }
  pushCell();
  pushRow();
  const headers = (rows[0] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`);
  const data = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
  return { headers, rows: data };
}

export function componentsFromProfiles(profiles: ColumnProfile[]): FormComponent[] {
  const taken = new Set<string>();
  return profiles.map((profile) => {
    const key = uniqueKey(profile.key || profile.field, taken);
    taken.add(key);
    const component = createComponent(profile.inferredType, key, uid("cmp"));
    component.label = profile.field;
    component.key = key;
    if (profile.options) component.values = profile.options;
    if (profile.nullCount === 0 && profile.count > 2 && profile.inferredType !== "checkbox") component.required = true;
    return component;
  });
}

export function looksLikeFieldTable(headers: string[]): boolean {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const hasField = norm.some((h) => ["field", "campo", "label", "name", "nombre"].includes(h));
  const hasType = norm.some((h) => ["type", "tipo"].includes(h));
  return hasField && hasType;
}

export function componentsFromFieldTable(rows: Record<string, string>[]): FormComponent[] {
  const taken = new Set<string>();
  return rows
    .map((row) => {
      const entries = Object.entries(row);
      const get = (...names: string[]) => {
        const found = entries.find(([key]) => names.includes(key.trim().toLowerCase()));
        return found?.[1]?.trim() ?? "";
      };
      const label = get("field", "campo", "label", "name", "nombre");
      if (!label) return null;
      const typeRaw = get("type", "tipo").toLowerCase();
      const type = mapTypeName(typeRaw);
      const key = uniqueKey(get("key", "clave") || label, taken);
      taken.add(key);
      const component = createComponent(type, key, uid("cmp"));
      component.label = label;
      component.key = key;
      const required = get("required", "requerido", "obligatorio").toLowerCase();
      component.required = ["yes", "true", "si", "sí", "y", "1"].includes(required);
      const options = get("options", "opciones", "values");
      if (options && (type === "select" || type === "radio" || type === "selectboxes")) {
        component.values = options.split(/[|,]/).map((part) => {
          const value = part.trim();
          return { label: value, value: slugKey(value, "option") };
        }).filter((opt) => opt.label);
      }
      const help = get("help", "description", "descripcion", "descripción");
      if (help) component.description = help;
      return component;
    })
    .filter((c): c is FormComponent => !!c);
}

function mapTypeName(type: string): FormComponent["type"] {
  const table: Record<string, FormComponent["type"]> = {
    text: "textfield", string: "textfield", textfield: "textfield", textarea: "textarea",
    number: "number", integer: "number", int: "number", email: "email", phone: "phone",
    tel: "phone", url: "url", date: "date", datetime: "datetime", time: "time",
    select: "select", dropdown: "select", radio: "radio", checkbox: "checkbox",
    boolean: "checkbox", currency: "currency", money: "currency", file: "file",
    signature: "signature", address: "address", rating: "rating", slider: "slider",
  };
  return table[type] ?? "textfield";
}

export function componentsFromSample(value: unknown, taken = new Set<string>()): FormComponent[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([key, raw]) => {
    const safe = uniqueKey(key, taken);
    taken.add(safe);
    if (Array.isArray(raw)) {
      const first = raw.find((item) => item && typeof item === "object" && !Array.isArray(item));
      const grid = createComponent("datagrid", safe, uid("cmp"));
      grid.label = labelFromKey(key);
      grid.key = safe;
      if (first && typeof first === "object") {
        grid.components = componentsFromSample(first, new Set());
      }
      return grid;
    }
    if (raw && typeof raw === "object") {
      const group = createComponent("container", safe, uid("cmp"));
      group.label = labelFromKey(key);
      group.key = safe;
      group.components = componentsFromSample(raw, new Set());
      return group;
    }
    const type = inferJsonType(key, raw);
    const component = createComponent(type, safe, uid("cmp"));
    component.label = labelFromKey(key);
    component.key = safe;
    return component;
  });
}

function labelFromKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function inferJsonType(key: string, value: unknown): FormComponent["type"] {
  const k = key.toLowerCase();
  if (k.includes("email")) return "email";
  if (k.includes("phone") || k.includes("tel")) return "phone";
  if (k.includes("url") || k.includes("website")) return "url";
  if (k.includes("date")) return "date";
  if (k.includes("password")) return "password";
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return Number.isInteger(value) ? "number" : "currency";
  if (typeof value === "string" && value.length > 80) return "textarea";
  return "textfield";
}

export function componentsFromJsonSchema(schema: Record<string, unknown>, taken = new Set<string>()): FormComponent[] {
  const properties = schema.properties;
  if (!properties || typeof properties !== "object") return [];
  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  return Object.entries(properties as Record<string, Record<string, unknown>>).map(([key, prop]) => {
    const safe = uniqueKey(key, taken);
    taken.add(safe);
    const type = jsonSchemaType(key, prop);
    const component = createComponent(type, safe, uid("cmp"));
    component.key = safe;
    component.label = typeof prop.title === "string" ? prop.title : labelFromKey(key);
    if (typeof prop.description === "string") component.description = prop.description;
    component.required = required.has(key);
    if (Array.isArray(prop.enum) && (type === "select" || type === "radio")) {
      component.values = prop.enum.map((item) => ({ label: String(item), value: slugKey(String(item), "option") }));
    }
    if (type === "datagrid" && prop.items && typeof prop.items === "object") {
      component.components = componentsFromJsonSchema(prop.items as Record<string, unknown>, new Set());
    }
    if (type === "container" && prop.properties) {
      component.components = componentsFromJsonSchema(prop, new Set());
    }
    return component;
  });
}

function jsonSchemaType(key: string, prop: Record<string, unknown>): FormComponent["type"] {
  if (Array.isArray(prop.enum)) return prop.enum.length <= 4 ? "radio" : "select";
  if (prop.type === "array") return "datagrid";
  if (prop.type === "object") return "container";
  if (prop.type === "boolean") return "checkbox";
  if (prop.type === "integer" || prop.type === "number") return "number";
  if (prop.format === "email") return "email";
  if (prop.format === "uri" || prop.format === "url") return "url";
  if (prop.format === "date") return "date";
  if (prop.format === "date-time") return "datetime";
  if (prop.format === "time") return "time";
  const k = key.toLowerCase();
  if (k.includes("email")) return "email";
  if (typeof prop.maxLength === "number" && prop.maxLength > 200) return "textarea";
  return "textfield";
}

const TYPE_MAP: Record<string, FormComponent["type"]> = {
  textfield: "textfield", textarea: "textarea", number: "number", password: "password",
  email: "email", phoneNumber: "phone", phone: "phone", url: "url", select: "select",
  radio: "radio", checkbox: "checkbox", selectboxes: "selectboxes", datetime: "datetime",
  day: "date", time: "time", currency: "currency", file: "file", signature: "signature",
  datagrid: "datagrid", editgrid: "datagrid", panel: "panel", columns: "columns",
  fieldset: "fieldset", tabs: "tabs", content: "content", htmlelement: "content",
  button: "button", hidden: "hidden", address: "address", survey: "radio", tags: "textfield",
  container: "container",
};

export interface ImportReport {
  imported: number;
  compatible: number;
  review: number;
  unsupported: { type: string; key: string }[];
  components: FormComponent[];
  display: "form" | "wizard";
  title?: string;
}

export function importFormio(raw: unknown): ImportReport {
  const root = raw as { title?: string; display?: string; components?: unknown[] };
  const unsupported: { type: string; key: string }[] = [];
  let review = 0;
  let compatible = 0;
  const convert = (node: unknown): FormComponent | null => {
    if (!node || typeof node !== "object") return null;
    const src = node as Record<string, unknown>;
    const original = String(src.type ?? "unknown");
    const mapped = TYPE_MAP[original];
    const key = slugKey(String(src.key ?? src.label ?? original));
    if (!mapped) {
      unsupported.push({ type: original, key });
      const fallback = createComponent("textfield", key || uid("field"), uid("cmp"));
      fallback.label = String(src.label ?? original);
      fallback.legacyNote = `Unsupported Form.io type “${original}” was kept as text for review`;
      review += 1;
      return fallback;
    }
    const component = createComponent(mapped, key || "field", uid("cmp"));
    component.key = key || component.key;
    component.label = String(src.label ?? component.label);
    if (typeof src.placeholder === "string") component.placeholder = src.placeholder;
    if (typeof src.description === "string") component.description = src.description;
    if (src.hidden === true) component.hidden = true;
    const validate = src.validate as { required?: boolean } | undefined;
    component.required = !!(src.required ?? validate?.required);
    if (Array.isArray(src.values) || Array.isArray(src.data)) {
      const values = (Array.isArray(src.values) ? src.values : ((src.data as { values?: unknown[] })?.values ?? [])) as { label?: string; value?: string }[];
      if (values.length) {
        component.values = values.map((item) => ({
          label: String(item.label ?? item.value ?? ""),
          value: slugKey(String(item.value ?? item.label ?? "option"), "option"),
        }));
      }
    }
    if (typeof src.customConditional === "string" || typeof src.calculateValue === "string") {
      component.legacyNote = "Legacy JavaScript logic was not imported. Recreate it with a safe expression.";
      review += 1;
    } else compatible += 1;
    if (Array.isArray(src.components)) component.components = src.components.map(convert).filter((c): c is FormComponent => !!c);
    if (Array.isArray(src.columns)) {
      component.columns = (src.columns as { width?: number; components?: unknown[] }[]).map((col) => ({
        width: Number(col.width ?? 6),
        components: (col.components ?? []).map(convert).filter((c): c is FormComponent => !!c),
      }));
    }
    return component;
  };
  const components = (root.components ?? []).map(convert).filter((c): c is FormComponent => !!c);
  const count = unsupported.length + compatible + review;
  return {
    imported: count,
    compatible,
    review,
    unsupported,
    components,
    display: root.display === "wizard" ? "wizard" : "form",
    title: root.title,
  };
}

export function detectJsonImport(raw: unknown): { kind: "form" | "formio" | "schema" | "sample" | "array"; components: FormComponent[]; display: "form" | "wizard"; title?: string; report?: ImportReport } {
  if (Array.isArray(raw)) {
    const first = raw.find((item) => item && typeof item === "object");
    return { kind: "array", components: first ? componentsFromSample(first) : [], display: "form" };
  }
  if (!raw || typeof raw !== "object") return { kind: "sample", components: [], display: "form" };
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.components) && (obj.display || obj.type === "form" || obj.title)) {
    const report = importFormio(obj);
    return { kind: "formio", components: report.components, display: report.display, title: report.title, report };
  }
  if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
    return {
      kind: "schema",
      components: componentsFromJsonSchema(obj),
      display: "form",
      title: typeof obj.title === "string" ? obj.title : undefined,
    };
  }
  return { kind: "sample", components: componentsFromSample(obj), display: "form" };
}

export function newFormShell(partial: Partial<FormDefinition> & Pick<FormDefinition, "title" | "components">): FormDefinition {
  const now = new Date().toISOString();
  const name = slugKey(partial.name || partial.title, "form");
  return {
    id: partial.id ?? uid("frm"),
    name,
    title: partial.title,
    description: partial.description ?? "",
    display: partial.display ?? "form",
    status: partial.status ?? "draft",
    version: partial.version ?? 1,
    hasUnpublishedChanges: partial.hasUnpublishedChanges ?? true,
    components: partial.components,
    settings: partial.settings ?? {
      submitLabel: "Submit",
      draftLabel: "Save draft",
      successMessage: "Saved. You can return to this record from the inbox.",
      allowDraft: true,
    },
    workflow: partial.workflow,
    storage: partial.storage,
    tags: partial.tags ?? [],
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
    versions: partial.versions ?? [],
    activity: partial.activity ?? [],
    pdfPages: partial.pdfPages ?? 1,
    source: partial.source,
  };
}
