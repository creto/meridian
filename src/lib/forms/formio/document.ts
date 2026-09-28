import { compileExpression } from "../expressions.ts";
import type { FormComponent, JsonValue, OptionItem, PdfPlacement, ValidateSpec } from "../types.ts";
import { applicableSettings, defaultSchema, upstreamType } from "./adapter.ts";
import { applyJsonLogic } from "./json-logic.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readPath(source: unknown, path: string): unknown {
  if (!path) return source;
  let current = source;
  for (const part of path.split(".")) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function hasPath(source: unknown, path: string): boolean {
  if (!path) return false;
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

export function writePath(source: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const root: Record<string, unknown> = { ...source };
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]!;
    const previous = cursor[key];
    const next = isRecord(previous) ? { ...previous } : {};
    cursor[key] = next;
    cursor = next;
  }
  cursor[parts[parts.length - 1]!] = value;
  return root;
}

export function removePath(source: Record<string, unknown>, path: string): Record<string, unknown> {
  const parts = path.split(".");
  if (!hasPath(source, path)) return { ...source };
  const root: Record<string, unknown> = { ...source };
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]!;
    const previous = cursor[key];
    const next = isRecord(previous) ? { ...previous } : {};
    cursor[key] = next;
    cursor = next;
  }
  delete cursor[parts[parts.length - 1]!];
  return root;
}

export function isSafeCalculate(value: string): boolean {
  if (value.length > 300) return false;
  if (/[;{}]|function\b|=>|\breturn\b|\bdata\b|\brow\b|\binstance\b|\btoken\b|\beval\b/.test(value)) return false;
  return compileExpression(value).ok;
}

export function conditionalExpression(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (value.show === false || value.json != null) return undefined;
  if (typeof value.when !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.when)) return undefined;
  if (typeof value.eq === "number" || typeof value.eq === "boolean") return `${value.when} == ${String(value.eq)}`;
  if (typeof value.eq === "string" && /^[A-Za-z0-9_]+$/.test(value.eq)) return `${value.when} == "${value.eq}"`;
  return undefined;
}

function cloneSchema(type: string): Record<string, unknown> {
  try {
    return structuredClone(defaultSchema(type));
  } catch {
    return { type };
  }
}

export function effectiveDocument(component: FormComponent): Record<string, unknown> {
  const type = upstreamType(component);
  const doc: Record<string, unknown> = { ...cloneSchema(type), ...(component.formio ?? {}) };
  doc.type = typeof component.formio?.type === "string" ? component.formio.type : type;
  doc.key = component.key;
  doc.label = component.label;
  if (component.placeholder !== undefined) doc.placeholder = component.placeholder;
  if (component.description !== undefined) doc.description = component.description;
  if (component.hidden !== undefined) doc.hidden = component.hidden;
  if (component.disabled !== undefined) doc.disabled = component.disabled;
  if (component.defaultValue !== undefined) doc.defaultValue = component.defaultValue;
  if (component.calculateValue && !hasPath(component.formio, "calculateValue")) doc.calculateValue = component.calculateValue;
  const validate: Record<string, unknown> = { ...(isRecord(doc.validate) ? doc.validate : {}) };
  if (component.required !== undefined) validate.required = !!component.required;
  if (component.validate) Object.assign(validate, component.validate);
  if (Object.keys(validate).length) doc.validate = validate;
  if (component.values?.length && !hasPath(component.formio, "data.values") && !hasPath(component.formio, "values")) {
    const data = isRecord(doc.data) ? { ...doc.data } : {};
    data.values = component.values;
    doc.data = data;
  }
  if (component.currency && !hasPath(component.formio, "currency")) doc.currency = component.currency;
  return doc;
}

export function readSetting(component: FormComponent, path: string): unknown {
  return readPath(effectiveDocument(component), path);
}

function asOptions(value: unknown): OptionItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value.slice(0, 80).map((item) => {
    if (!isRecord(item)) return null;
    const label = String(item.label ?? item.value ?? "");
    const stored = item.value == null ? label : String(item.value);
    if (!label && !stored) return null;
    return { label, value: stored };
  }).filter((item): item is OptionItem => !!item);
  return options;
}

function assignValidate(component: FormComponent, key: keyof ValidateSpec, value: unknown) {
  const next: ValidateSpec = { ...(component.validate ?? {}) };
  if (value == null || value === "") delete next[key];
  else if (key === "pattern" || key === "patternMessage" || key === "custom" || key === "customMessage") {
    if (typeof value === "string") next[key] = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    next[key] = value;
  }
  component.validate = Object.keys(next).length ? next : undefined;
}

function syncOverlay(component: FormComponent) {
  const overlay = component.formio?.overlay;
  if (!isRecord(overlay)) return;
  const page = Number(overlay.page);
  const x = Number(overlay.left);
  const y = Number(overlay.top);
  const w = Number(overlay.width);
  const h = Number(overlay.height);
  if ([page, x, y, w, h].every((item) => Number.isFinite(item))) {
    const pdf: PdfPlacement = { page, x, y, w, h };
    component.pdf = pdf;
  }
}

export function writeSetting(component: FormComponent, path: string, value: unknown): FormComponent {
  const next: FormComponent = { ...component, validate: component.validate ? { ...component.validate } : undefined };
  let formio: Record<string, unknown> = { ...(component.formio ?? {}) };
  const defaults = cloneSchema(upstreamType(next));
  const fallback = readPath(defaults, path);
  const explicit = JSON.stringify(value) !== JSON.stringify(fallback);
  formio = explicit ? writePath(formio, path, value) : removePath(formio, path);
  next.formio = formio as { [key: string]: JsonValue };
  if (path === "label" && typeof value === "string") next.label = value;
  if (path === "key" && typeof value === "string") next.key = value;
  if (path === "placeholder") next.placeholder = typeof value === "string" && value ? value : undefined;
  if (path === "description") next.description = typeof value === "string" && value ? value : undefined;
  if (path === "hidden") next.hidden = value === true ? true : undefined;
  if (path === "disabled") next.disabled = value === true ? true : undefined;
  if (path === "currency" && typeof value === "string") next.currency = value;
  if (path === "defaultValue") {
    if (value == null || value === "") next.defaultValue = undefined;
    else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") next.defaultValue = value;
  }
  if (path === "validate.required" || path === "required") next.required = value === true ? true : undefined;
  if (path === "validate.pattern") assignValidate(next, "pattern", value);
  if (path === "validate.customMessage") assignValidate(next, "patternMessage", value);
  if (path === "validate.minLength") assignValidate(next, "minLength", value);
  if (path === "validate.maxLength") assignValidate(next, "maxLength", value);
  if (path === "validate.min") assignValidate(next, "min", value);
  if (path === "validate.max") assignValidate(next, "max", value);
  if (path === "validate.minWords") assignValidate(next, "minWords", value);
  if (path === "validate.maxWords") assignValidate(next, "maxWords", value);
  if (path === "data.values" || path === "values") {
    const options = asOptions(value);
    if (options) next.values = options;
  }
  if (path === "calculateValue") {
    if (typeof value !== "string" || !value.trim()) next.calculateValue = undefined;
    else if (isSafeCalculate(value)) next.calculateValue = value;
    else {
      next.calculateValue = undefined;
      next.legacyNote = "Legacy JavaScript calculateValue was preserved and is not executed.";
    }
  }
  if (path === "customConditional" || path === "validate.custom" || path === "customDefaultValue") {
    if (typeof value === "string" && value.trim()) {
      next.legacyNote = `Legacy JavaScript ${path} was preserved and is not executed.`;
    }
  }
  if (path === "conditional" || path.startsWith("conditional.")) {
    const expression = conditionalExpression(readPath(next.formio, "conditional"));
    next.conditional = expression;
  }
  if (path.startsWith("overlay.")) syncOverlay(next);
  if (!Object.keys(formio).length) next.formio = undefined;
  return next;
}

export function componentJson(component: FormComponent): Record<string, unknown> {
  const doc = effectiveDocument(component);
  delete doc.id;
  if (component.components) doc.components = component.components.map((child) => componentJson(child));
  if (component.columns) {
    doc.columns = component.columns.map((column) => ({
      width: column.width,
      components: column.components.map((child) => componentJson(child)),
    }));
  }
  return doc;
}

const STRUCTURAL = new Set(["components", "columns"]);

export function rememberFormio(component: FormComponent, node: Record<string, unknown>): FormComponent {
  const formio: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (STRUCTURAL.has(key)) continue;
    formio[key] = value;
  }
  component.formio = formio as { [key: string]: JsonValue };
  return component;
}

export function settingVisible(component: FormComponent, conditional: unknown): boolean {
  const doc = effectiveDocument(component);
  if (!isRecord(conditional)) return true;
  if (conditional.json != null) {
    try {
      return !!applyJsonLogic(conditional.json, { data: doc, row: doc });
    } catch {
      return true;
    }
  }
  if (typeof conditional.when === "string") {
    const current = readPath(doc, conditional.when);
    const match = current === conditional.eq || String(current ?? "") === String(conditional.eq ?? "");
    return conditional.show === false ? !match : match;
  }
  return true;
}

export function knownProperty(component: FormComponent, path: string): boolean {
  return applicableSettings(upstreamType(component)).some((setting) => setting.key === path);
}

export function searchSettings(component: FormComponent, query: string) {
  const needle = query.trim().toLowerCase();
  return applicableSettings(upstreamType(component)).filter((setting) => {
    if (!needle) return true;
    return `${setting.label ?? ""} ${setting.key} ${setting.tooltip ?? ""}`.toLowerCase().includes(needle);
  });
}

export function validateSettingValue(path: string, value: unknown): string | null {
  if (path === "key" && (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))) {
    return "Property name must start with a letter or underscore and use only letters, numbers, and underscores.";
  }
  if (path === "validate.pattern" && typeof value === "string" && value) {
    try {
      RegExp(value);
    } catch {
      return "Pattern is not a valid regular expression.";
    }
  }
  if ((path === "data.url" || path.endsWith(".url")) && typeof value === "string" && value) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) return "URL must be http or https.";
    } catch {
      return "URL is not valid.";
    }
  }
  if ((path === "data.json" || path === "conditional.json" || path.endsWith(".json")) && typeof value === "string" && value.trim()) {
    try {
      JSON.parse(value);
    } catch {
      return "JSON is not valid.";
    }
  }
  return null;
}

export function validateSettingPair(component: FormComponent): string | null {
  const min = readSetting(component, "validate.min");
  const max = readSetting(component, "validate.max");
  if (typeof min === "number" && typeof max === "number" && min > max) return "Minimum is greater than maximum.";
  const minLength = readSetting(component, "validate.minLength");
  const maxLength = readSetting(component, "validate.maxLength");
  if (typeof minLength === "number" && typeof maxLength === "number" && minLength > maxLength) return "Minimum length is greater than maximum length.";
  return null;
}

export function duplicateKey(components: FormComponent[], id: string, key: string): boolean {
  const walk = (list: FormComponent[]): boolean => list.some((item) => (item.id !== id && item.key === key) || (item.components ? walk(item.components) : false) || (item.columns ? item.columns.some((column) => walk(column.components)) : false));
  return walk(components);
}

export function referenceWarnings(components: FormComponent[], previousKey: string, nextKey: string): string[] {
  if (!previousKey || previousKey === nextKey) return [];
  const notes: string[] = [];
  const walk = (list: FormComponent[]) => {
    for (const component of list) {
      const blob = JSON.stringify({ conditional: component.conditional, calculateValue: component.calculateValue, formio: component.formio, pdf: component.pdf });
      if (blob.includes(previousKey)) notes.push(`${component.label || component.key} still mentions “${previousKey}”.`);
      if (component.components) walk(component.components);
      component.columns?.forEach((column) => walk(column.components));
    }
  };
  walk(components);
  return notes.slice(0, 8);
}

export function publicSubmission(components: FormComponent[], data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  const walk = (list: FormComponent[], target: Record<string, unknown>) => {
    for (const component of list) {
      const persistent = component.formio?.persistent;
      const drop = component.formio?.protected === true || component.formio?.encrypted === true || persistent === false || persistent === "client-only";
      if (drop && component.key) delete target[component.key];
      if (component.type === "container" && isRecord(target[component.key])) {
        const child = { ...(target[component.key] as Record<string, unknown>) };
        walk(component.components ?? [], child);
        target[component.key] = child;
      }
      if (component.components && component.type !== "datagrid" && component.type !== "container") walk(component.components, target);
      component.columns?.forEach((column) => walk(column.components, target));
    }
  };
  walk(components, next);
  return next;
}
