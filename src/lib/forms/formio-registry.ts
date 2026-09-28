import { createComponent } from "./catalog.ts";
import { rememberFormio } from "./formio/document.ts";
import { slugKey, uid } from "./ids.ts";
import type { ComponentType, FormComponent, ValidateSpec } from "./types.ts";

export type Support = "FULLY_SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED";

export interface FormioImportNode {
  component: FormComponent;
  support: Support;
  warnings: string[];
}

export interface FormioComponentAdapter {
  sourceType: string;
  canImport(node: Record<string, unknown>): boolean;
  import(node: Record<string, unknown>): FormioImportNode;
}

const TARGETS: Record<string, ComponentType> = {
  textfield: "textfield",
  textarea: "textarea",
  number: "number",
  email: "email",
  phoneNumber: "phone",
  url: "url",
  select: "select",
  radio: "radio",
  checkbox: "checkbox",
  selectboxes: "selectboxes",
  datetime: "datetime",
  day: "date",
  time: "time",
  currency: "currency",
  file: "file",
  signature: "signature",
  address: "address",
  panel: "panel",
  columns: "columns",
  tabs: "tabs",
  datagrid: "datagrid",
  editgrid: "datagrid",
  container: "container",
  content: "content",
  htmlelement: "content",
  button: "button",
  hidden: "hidden",
  survey: "radio",
  recaptcha: "captcha",
};

const CHOICE_TYPES = new Set<ComponentType>(["select", "radio", "selectboxes"]);
const NESTED_TYPES = new Set<ComponentType>(["panel", "fieldset", "tabs", "datagrid", "container"]);

const adapters = new Map<string, FormioComponentAdapter>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function truncate(script: string, max = 180): string {
  return script.length <= max ? script : script.slice(0, max);
}

function isFieldName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

/** Values may be quoted strings. Digits are allowed; punctuation other than underscore is not. */
function isSafeLiteral(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_]+$/.test(value);
}

function optionItems(node: Record<string, unknown>): { label: string; value: string }[] | null {
  const raw = Array.isArray(node.values)
    ? node.values
    : Array.isArray(node.data)
      ? node.data
      : isRecord(node.data) && Array.isArray(node.data.values)
        ? node.data.values
        : null;
  if (!raw) return null;
  const items: { label: string; value: string }[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      items.push({ label: item, value: item });
      continue;
    }
    if (!isRecord(item)) continue;
    const label =
      item.label != null ? String(item.label) : item.value != null ? String(item.value) : "";
    const value = item.value != null ? String(item.value) : label;
    if (!label && !value) continue;
    items.push({ label, value });
  }
  return items;
}

function translateConditional(
  raw: unknown,
  warnings: string[],
): { ok: true; expression: string } | { ok: false; partial: boolean } {
  if (raw == null) return { ok: false, partial: false };
  if (typeof raw === "string") {
    warnings.push(`conditional was not executed: ${truncate(raw)}`);
    return { ok: false, partial: true };
  }
  if (!isRecord(raw)) {
    warnings.push("conditional is not a simple {show, when, eq} object");
    return { ok: false, partial: true };
  }
  if (typeof raw.json === "string" && raw.json.trim()) {
    warnings.push(`conditional.json was not executed: ${truncate(raw.json)}`);
    return { ok: false, partial: true };
  }
  const showOk = raw.show == null || raw.show === true;
  if (!showOk || !isFieldName(raw.when) || !isSafeLiteral(raw.eq)) {
    warnings.push(
      "conditional was not translated; when and eq must be identifiers or strings with no punctuation other than underscore",
    );
    return { ok: false, partial: true };
  }
  return { ok: true, expression: `${raw.when} == "${raw.eq}"` };
}

function clearCatalogDefaults(component: FormComponent, target: ComponentType): void {
  delete component.placeholder;
  delete component.description;
  delete component.values;
  delete component.defaultValue;
  delete component.currency;
  delete component.min;
  delete component.max;
  delete component.step;
  if (target !== "hidden") delete component.hidden;
  if (NESTED_TYPES.has(target)) component.components = [];
  if (target === "columns") component.columns = [];
  if (target === "content") component.variant = "paragraph";
  if (target === "hidden") component.hidden = true;
}

function applyValidate(
  node: Record<string, unknown>,
  warnings: string[],
): {
  spec?: ValidateSpec;
  required: boolean;
  partial: boolean;
} {
  if (!isRecord(node.validate)) return { required: false, partial: false };
  const src = node.validate;
  const spec: ValidateSpec = {};
  if (typeof src.min === "number") spec.min = src.min;
  if (typeof src.max === "number") spec.max = src.max;
  if (typeof src.minLength === "number") spec.minLength = src.minLength;
  if (typeof src.maxLength === "number") spec.maxLength = src.maxLength;
  if (typeof src.pattern === "string") spec.pattern = src.pattern;
  if (typeof src.patternMessage === "string") spec.patternMessage = src.patternMessage;
  let partial = false;
  if (typeof src.custom === "string") {
    partial = true;
    warnings.push(`validate.custom was not executed: ${truncate(src.custom)}`);
  } else if (typeof src.customMessage === "string") {
    spec.customMessage = src.customMessage;
  }
  return {
    spec: Object.keys(spec).length > 0 ? spec : undefined,
    required: src.required === true,
    partial,
  };
}

function surveyQuestions(node: Record<string, unknown>): string[] {
  if (!Array.isArray(node.questions)) return [];
  const labels: string[] = [];
  for (const question of node.questions) {
    if (typeof question === "string" && question.trim()) {
      labels.push(question.trim());
      continue;
    }
    if (!isRecord(question)) continue;
    const label =
      typeof question.label === "string"
        ? question.label
        : typeof question.value === "string"
          ? question.value
          : "";
    if (label.trim()) labels.push(label.trim());
  }
  return labels;
}

function importChildList(raw: unknown): FormComponent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((child) => importFormioNode(child).component);
}

function importKnown(
  node: Record<string, unknown>,
  target: ComponentType,
  sourceType: string,
): FormioImportNode {
  const rawKey =
    typeof node.key === "string" && node.key.trim()
      ? node.key
      : typeof node.label === "string" && node.label.trim()
        ? node.label
        : sourceType;
  const key = slugKey(rawKey, "field");
  const component = createComponent(target, key, uid("cmp"));
  clearCatalogDefaults(component, target);
  component.key = key;
  if (typeof node.label === "string") component.label = node.label;

  if (typeof node.placeholder === "string") component.placeholder = node.placeholder;
  if (target !== "content" && typeof node.description === "string") {
    component.description = node.description;
  }
  if (node.disabled === true) component.disabled = true;
  if (node.hidden === true || target === "hidden") component.hidden = true;
  if (
    typeof node.defaultValue === "string" ||
    typeof node.defaultValue === "number" ||
    typeof node.defaultValue === "boolean" ||
    node.defaultValue === null
  ) {
    component.defaultValue = node.defaultValue;
  }
  if (target === "currency" && typeof node.currency === "string" && node.currency) {
    component.currency = node.currency;
  }

  const warnings: string[] = [];
  const legacy: string[] = [];
  let support: Support = "FULLY_SUPPORTED";

  const validation = applyValidate(node, warnings);
  if (validation.spec) component.validate = validation.spec;
  if (node.required === true || validation.required) component.required = true;
  if (validation.partial) support = "PARTIALLY_SUPPORTED";

  if (CHOICE_TYPES.has(target)) {
    const options = optionItems(node);
    if (options) component.values = options;
  }

  if (target === "content") {
    const html =
      typeof node.html === "string"
        ? node.html
        : typeof node.content === "string"
          ? node.content
          : undefined;
    if (typeof node.description === "string") component.description = node.description;
    else if (html !== undefined) component.description = html;
    if (node.tag === "h1" || node.tag === "h2" || node.tag === "h3") component.variant = "heading";
  }

  if (sourceType === "survey") {
    const questions = surveyQuestions(node);
    if (questions.length > 0) {
      const text = questions.join("; ");
      component.description = component.description ? `${component.description} — ${text}` : text;
    }
  }

  if (NESTED_TYPES.has(target)) component.components = importChildList(node.components);
  if (target === "columns") {
    const columns = Array.isArray(node.columns) ? node.columns : [];
    component.columns = columns.map((col) => {
      if (Array.isArray(col)) return { width: 6, components: importChildList(col) };
      const rec = isRecord(col) ? col : {};
      const width =
        typeof rec.width === "number" ? rec.width : typeof rec.size === "number" ? rec.size : 6;
      const children = Array.isArray(rec.components) ? rec.components : [];
      return { width, components: importChildList(children) };
    });
  }

  if (typeof node.customConditional === "string") {
    const script = truncate(node.customConditional);
    warnings.push(`customConditional was not executed: ${script}`);
    legacy.push(`customConditional: ${script}`);
    support = "PARTIALLY_SUPPORTED";
  } else if (node.conditional != null) {
    const translated = translateConditional(node.conditional, warnings);
    if (translated.ok) component.conditional = translated.expression;
    else if (translated.partial) support = "PARTIALLY_SUPPORTED";
  }

  if (typeof node.calculateValue === "string") {
    const script = truncate(node.calculateValue);
    warnings.push(`calculateValue was not executed: ${script}`);
    legacy.push(`calculateValue: ${script}`);
    support = "PARTIALLY_SUPPORTED";
  }

  if (legacy.length > 0) {
    component.legacyNote = `Legacy JavaScript logic was not imported. ${legacy.join(" | ")}`;
  }
  rememberFormio(component, node);

  return { component, support, warnings };
}

function importUnknown(node: Record<string, unknown>): FormioImportNode {
  const sourceType = typeof node.type === "string" && node.type ? node.type : "unknown";
  const label =
    typeof node.label === "string" && node.label
      ? node.label
      : typeof node.key === "string" && node.key
        ? node.key
        : sourceType;
  const rawKey = typeof node.key === "string" && node.key.trim() ? node.key : label;
  const key = slugKey(rawKey, "field");
  const component = createComponent("textfield", key, uid("cmp"));
  clearCatalogDefaults(component, "textfield");
  component.key = key;
  component.label = label;

  const copied = new Set<string>();
  if (typeof node.label === "string") copied.add("label");
  if (typeof node.key === "string") copied.add("key");
  const dropped = Object.keys(node).filter((prop) => !copied.has(prop));
  const warnings: string[] = [];
  if (dropped.length > 0) warnings.push(`Dropped properties: ${dropped.join(", ")}`);

  if (typeof node.customConditional === "string") {
    warnings.push(`customConditional was not executed: ${truncate(node.customConditional)}`);
  }
  if (typeof node.calculateValue === "string") {
    warnings.push(`calculateValue was not executed: ${truncate(node.calculateValue)}`);
  }

  const droppedNote = dropped.length > 0 ? ` Dropped properties: ${dropped.join(", ")}.` : "";
  component.legacyNote = `Unsupported Form.io type “${sourceType}” was kept as text for review.${droppedNote}`;
  rememberFormio(component, node);
  return { component, support: "UNSUPPORTED", warnings };
}

for (const [sourceType, target] of Object.entries(TARGETS)) {
  const adapter: FormioComponentAdapter = {
    sourceType,
    canImport(node) {
      return node.type === sourceType;
    },
    import(node) {
      return importKnown(node, target, sourceType);
    },
  };
  adapters.set(sourceType, adapter);
}

export function importFormioNode(node: unknown): FormioImportNode {
  if (!isRecord(node)) {
    const component = createComponent("textfield", "field", uid("cmp"));
    clearCatalogDefaults(component, "textfield");
    component.key = "field";
    component.label = "Unknown";
    component.legacyNote = "Unsupported Form.io node was kept as text for review.";
    return {
      component,
      support: "UNSUPPORTED",
      warnings: ["Dropped properties: <root>"],
    };
  }
  const sourceType = typeof node.type === "string" ? node.type : "";
  if (!sourceType && (Array.isArray(node.components) || Array.isArray(node.columns))) {
    return importKnown({ ...node, type: "panel" }, "panel", "panel");
  }
  const adapter = sourceType ? adapters.get(sourceType) : undefined;
  if (!adapter || !adapter.canImport(node)) return importUnknown(node);
  return adapter.import(node);
}

export function importFormioTree(raw: unknown): {
  title?: string;
  display: "form" | "wizard";
  nodes: FormioImportNode[];
  components: FormComponent[];
} {
  if (Array.isArray(raw)) {
    const nodes = raw.map((item) => importFormioNode(item));
    return { display: "form", nodes, components: nodes.map((node) => node.component) };
  }
  if (!isRecord(raw)) return { display: "form", nodes: [], components: [] };
  const title = typeof raw.title === "string" ? raw.title : undefined;
  const display = raw.display === "wizard" ? "wizard" : "form";
  const list = Array.isArray(raw.components) ? raw.components : [];
  const nodes = list.map((item) => importFormioNode(item));
  return {
    ...(title !== undefined ? { title } : {}),
    display,
    nodes,
    components: nodes.map((node) => node.component),
  };
}

export function supportSummary(nodes: FormioImportNode[]): {
  full: number;
  partial: number;
  unsupported: number;
} {
  const summary = { full: 0, partial: 0, unsupported: 0 };
  for (const node of nodes) {
    if (node.support === "FULLY_SUPPORTED") summary.full += 1;
    else if (node.support === "PARTIALLY_SUPPORTED") summary.partial += 1;
    else summary.unsupported += 1;
  }
  return summary;
}
