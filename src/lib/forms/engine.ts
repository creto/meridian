import { asNumber, evalBool, evaluate, isEmpty, referencedKeys } from "./expressions.ts";
import { checkCaptcha, readCaptcha } from "./captcha.ts";
import { applyJsonLogic } from "./formio/json-logic.ts";
import { fileNameAllowed, parseByteLimit, wordCount } from "./formio/coerce.ts";
import { isLayout, walkComponents } from "./tree.ts";
import type { FormComponent, FormDefinition } from "./types.ts";

export type ErrorMap = Record<string, string>;

export function scopeFor(data: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...data, data, ...extra };
}

export function isVisible(component: FormComponent, data: Record<string, unknown>): boolean {
  if (component.hidden) return false;
  const conditional = component.formio?.conditional;
  if (conditional && typeof conditional === "object" && !Array.isArray(conditional)) {
    const json = (conditional as { json?: unknown }).json;
    if (json && typeof json === "object") {
      try {
        return !!applyJsonLogic(json, { data, row: data });
      } catch {
        return true;
      }
    }
  }
  if (!component.conditional) return true;
  return evalBool(component.conditional, scopeFor(data), true);
}

export function clearsOnHide(component: FormComponent): boolean {
  if (!component.formio) return false;
  return component.formio.clearOnHide !== false;
}

export function applyClearOnHide(components: FormComponent[], data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  const visit = (list: FormComponent[], target: Record<string, unknown>, parentVisible: boolean) => {
    for (const component of list) {
      const visible = parentVisible && isVisible(component, next);
      const structural = component.type === "panel" || component.type === "fieldset" || component.type === "tabs" || component.type === "columns" || component.type === "content" || component.type === "button" || component.type === "review";
      if (!visible && clearsOnHide(component) && component.key && !structural && component.type !== "container" && component.type !== "datagrid") {
        target[component.key] = emptyValue(component);
      }
      if (component.type === "datagrid") {
        if (!visible && clearsOnHide(component)) target[component.key] = [];
        else if (Array.isArray(target[component.key])) {
          target[component.key] = (target[component.key] as Record<string, unknown>[]).map((row) => {
            const copy = { ...row };
            visit(component.components ?? [], copy, visible);
            return copy;
          });
        }
        continue;
      }
      if (component.type === "container") {
        const obj = target[component.key] && typeof target[component.key] === "object" ? { ...(target[component.key] as Record<string, unknown>) } : {};
        visit(component.components ?? [], obj, visible);
        target[component.key] = obj;
        continue;
      }
      if (component.type === "columns") component.columns?.forEach((col) => visit(col.components, target, visible));
      else if (component.components) visit(component.components, target, visible);
    }
  };
  visit(components, next, true);
  return next;
}

function childLists(component: FormComponent): FormComponent[][] {
  const lists: FormComponent[][] = [];
  if (component.components) lists.push(component.components);
  component.columns?.forEach((col) => lists.push(col.components));
  return lists;
}

function structuralKeys(list: FormComponent[]): Set<string> {
  const keys = new Set<string>();
  const walk = (items: FormComponent[]) => {
    for (const component of items) {
      if (component.type === "datagrid" || component.type === "container") keys.add(component.key);
      if (isLayout(component) || component.type === "columns" || component.type === "panel" || component.type === "fieldset" || component.type === "tabs") {
        childLists(component).forEach(walk);
      }
    }
  };
  walk(list);
  return keys;
}

function calculatedIn(list: FormComponent[]): FormComponent[] {
  const fields: FormComponent[] = [];
  const visit = (items: FormComponent[]) => {
    for (const component of items) {
      if (component.type === "datagrid" || component.type === "container") continue;
      if (component.calculateValue) fields.push(component);
      if (isLayout(component) || component.type === "columns" || component.type === "panel" || component.type === "fieldset" || component.type === "tabs") {
        childLists(component).forEach(visit);
      }
    }
  };
  visit(list);
  return fields;
}

/** Dependencies first. A cycle is skipped rather than evaluated forever. */
function calculationOrder(fields: FormComponent[]): FormComponent[] {
  const keys = new Set(fields.map((field) => field.key));
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const deps = new Map(
    fields.map((field) => [
      field.key,
      referencedKeys(field.calculateValue ?? "").filter((key) => keys.has(key) && key !== field.key),
    ]),
  );
  const ordered: FormComponent[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const walk = (key: string) => {
    if (done.has(key) || visiting.has(key)) return;
    visiting.add(key);
    for (const dep of deps.get(key) ?? []) walk(dep);
    visiting.delete(key);
    done.add(key);
    const field = byKey.get(key);
    if (field) ordered.push(field);
  };
  for (const field of fields) walk(field.key);
  return ordered;
}

export function applyCalculations(components: FormComponent[], data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  const runField = (component: FormComponent, target: Record<string, unknown>, rowScope?: Record<string, unknown>, rows?: unknown[]) => {
    if (!component.calculateValue) return;
    const refs = referencedKeys(component.calculateValue);
    if (refs.includes(component.key)) return;
    const scope = scopeFor(next, {
      ...target,
      ...(rowScope ?? {}),
      row: rowScope?.row ?? target,
      rows: rows ?? [],
      value: target[component.key],
    });
    const result = evaluate(component.calculateValue, scope);
    if (result.ok) target[component.key] = result.value ?? "";
  };

  const visit = (list: FormComponent[], target: Record<string, unknown>) => {
    const walkNodes = (items: FormComponent[]) => {
      for (const component of items) {
        if (component.type === "datagrid") {
          const rowsValue = Array.isArray(target[component.key]) ? (target[component.key] as Record<string, unknown>[]) : [];
          const columns = calculationOrder((component.components ?? []).filter((column) => column.calculateValue));
          target[component.key] = rowsValue.map((row) => {
            const copy = { ...row };
            for (const column of columns) runField(column, copy, { row: copy, ...copy }, rowsValue);
            return copy;
          });
          continue;
        }
        if (component.type === "container") {
          const obj =
            target[component.key] && typeof target[component.key] === "object"
              ? { ...(target[component.key] as Record<string, unknown>) }
              : {};
          visit(component.components ?? [], obj);
          target[component.key] = obj;
          continue;
        }
        if (isLayout(component) || component.type === "columns" || component.type === "panel" || component.type === "fieldset" || component.type === "tabs") {
          childLists(component).forEach(walkNodes);
        }
      }
    };
    const structures = structuralKeys(list);
    const ordered = calculationOrder(calculatedIn(list));
    const upstream = ordered.filter((field) => !referencedKeys(field.calculateValue ?? "").some((key) => structures.has(key)));
    const downstream = ordered.filter((field) => referencedKeys(field.calculateValue ?? "").some((key) => structures.has(key)));
    for (const field of upstream) runField(field, target);
    // Grids and containers read upstream values, then parent formulas read the grids.
    walkNodes(list);
    for (const field of downstream) runField(field, target);
  };
  visit(components, next);
  return next;
}

export function calculationCycles(components: FormComponent[]): string[][] {
  const graph = new Map<string, string[]>();
  walkComponents(components, ({ component }) => {
    if (!component.calculateValue || !component.key) return;
    graph.set(component.key, referencedKeys(component.calculateValue));
  });
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const dfs = (key: string) => {
    if (visiting.has(key)) {
      const at = stack.indexOf(key);
      cycles.push(stack.slice(at).concat(key));
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    for (const dep of graph.get(key) ?? []) {
      if (graph.has(dep)) dfs(dep);
    }
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of graph.keys()) dfs(key);
  return cycles;
}

function patternOk(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

function validateField(component: FormComponent, value: unknown, data: Record<string, unknown>, path: string, errors: ErrorMap) {
  if (!isVisible(component, data) || component.disabled) return;
  const label = component.label || component.key;
  if (component.type === "captcha") {
    if (component.required === false && (value == null || value === "")) return;
    const parsed = readCaptcha(value);
    if (!parsed || !parsed.answer.trim()) {
      errors[path] = "Complete the captcha";
      return;
    }
    const verdict = checkCaptcha(parsed.id, parsed.answer);
    if (!verdict.ok) errors[path] = verdict.message;
    return;
  }
  if (component.type === "checkbox" || component.type === "toggle") {
    if (component.required && value !== true) errors[path] = `${label} is required`;
    return;
  }
  if (component.required && isEmpty(value)) {
    errors[path] = `${label} is required`;
    return;
  }
  if (isEmpty(value)) return;
  const spec = component.validate;
  if (component.type === "email" && typeof value === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors[path] = "Enter a valid email";
  }
  if (component.type === "url" && typeof value === "string") {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) errors[path] = "Enter an http(s) URL";
    } catch {
      errors[path] = "Enter a valid URL";
    }
  }
  if (spec?.minLength != null && typeof value === "string" && value.length < spec.minLength) {
    errors[path] = `${label} must be at least ${spec.minLength} characters`;
  }
  if (spec?.maxLength != null && typeof value === "string" && value.length > spec.maxLength) {
    errors[path] = `${label} must be at most ${spec.maxLength} characters`;
  }
  const num = asNumber(value);
  if ((component.type === "number" || component.type === "currency" || component.type === "slider") && typeof value === "string" && value !== "" && num == null) {
    errors[path] = `${label} must be a number`;
  }
  if (spec?.min != null && num != null && num < spec.min) errors[path] = `${label} must be at least ${spec.min}`;
  if (spec?.max != null && num != null && num > spec.max) errors[path] = `${label} must be at most ${spec.max}`;
  if (spec?.pattern && typeof value === "string" && !patternOk(spec.pattern, value)) {
    const errorLabel = typeof component.formio?.errorLabel === "string" ? component.formio.errorLabel : "";
    errors[path] = spec.patternMessage || errorLabel || `${label} is not in the expected format`;
  }
  if (typeof value === "string") {
    const formioValidate = component.formio?.validate;
    const formioWords = formioValidate && typeof formioValidate === "object" ? formioValidate as { minWords?: unknown; maxWords?: unknown } : {};
    const minWords = spec?.minWords ?? (typeof formioWords.minWords === "number" ? formioWords.minWords : undefined);
    const maxWords = spec?.maxWords ?? (typeof formioWords.maxWords === "number" ? formioWords.maxWords : undefined);
    if (minWords != null && wordCount(value) < minWords) errors[path] = `${label} must be at least ${minWords} words`;
    if (maxWords != null && wordCount(value) > maxWords) errors[path] = `${label} must be at most ${maxWords} words`;
  }
  if (spec?.custom) {
    const result = evaluate(spec.custom, scopeFor(data, { value }));
    if (!result.ok) errors[path] = `Validation rule error: ${result.error}`;
    else if (!result.value) errors[path] = spec.customMessage || `${label} is invalid`;
  }
  if (component.type === "address" && value && typeof value === "object") {
    const addr = value as Record<string, unknown>;
    if (component.required && isEmpty(addr.line1)) errors[path] = `${label} needs a street`;
  }
  if (component.type === "file" && value && typeof value === "object") {
    const file = value as { size?: number; name?: string };
    const maxBytes = spec?.max ?? parseByteLimit(component.formio?.fileMaxSize);
    const minBytes = parseByteLimit(component.formio?.fileMinSize);
    if (maxBytes != null && (file.size ?? 0) > maxBytes) errors[path] = `${label} exceeds the size limit`;
    if (minBytes != null && (file.size ?? 0) < minBytes) errors[path] = `${label} is smaller than the minimum size`;
    const pattern = typeof component.formio?.filePattern === "string" ? component.formio.filePattern : "";
    if (pattern && file.name && !fileNameAllowed(pattern, file.name)) errors[path] = `${label} is not an allowed file type`;
  }
}

export function validateComponents(
  components: FormComponent[],
  data: Record<string, unknown>,
  basePath = "",
): ErrorMap {
  const errors: ErrorMap = {};
  const visit = (list: FormComponent[], target: Record<string, unknown>, prefix: string) => {
    for (const component of list) {
      if (component.type === "hidden") continue;
      if (!isVisible(component, data) && component.type !== "container" && component.type !== "datagrid") {
        if (isLayout(component)) continue;
      }
      if (component.type === "panel" || component.type === "fieldset" || component.type === "tabs" || component.type === "content" || component.type === "button" || component.type === "review") {
        childLists(component).forEach((children) => visit(children, target, prefix));
        continue;
      }
      if (component.type === "columns") {
        component.columns?.forEach((col) => visit(col.components, target, prefix));
        continue;
      }
      const path = prefix ? `${prefix}.${component.key}` : component.key;
      if (component.type === "datagrid") {
        const rows = Array.isArray(target[component.key]) ? (target[component.key] as Record<string, unknown>[]) : [];
        if (component.required && rows.length === 0) errors[path] = `${component.label} needs at least one row`;
        rows.forEach((row, index) => {
          for (const col of component.components ?? []) {
            if (!evalBool(col.conditional, scopeFor(data, { ...row, row }), true) || col.hidden) continue;
            validateField(col, row[col.key], data, `${path}.${index}.${col.key}`, errors);
          }
        });
        continue;
      }
      if (component.type === "container") {
        const obj =
          target[component.key] && typeof target[component.key] === "object"
            ? (target[component.key] as Record<string, unknown>)
            : {};
        visit(component.components ?? [], obj, path);
        continue;
      }
      if (!isVisible(component, data)) continue;
      validateField(component, target[component.key], data, path, errors);
    }
  };
  visit(components, data, basePath);
  return errors;
}

export function validatePage(page: FormComponent, data: Record<string, unknown>): ErrorMap {
  return validateComponents(page.components ?? [], data);
}

export function validateForm(form: Pick<FormDefinition, "components" | "display">, data: Record<string, unknown>): ErrorMap {
  return validateComponents(form.components, data);
}

export function wizardPages(components: FormComponent[]): FormComponent[] {
  const pages = components.filter((c) => c.type === "panel" || c.type === "fieldset");
  if (pages.length === 0) return [];
  return pages;
}

export function emptyValue(component: FormComponent): unknown {
  if (component.defaultValue !== undefined) return structuredClone(component.defaultValue);
  switch (component.type) {
    case "checkbox":
    case "toggle":
      return false;
    case "selectboxes":
      return [] as string[];
    case "datagrid":
      return [] as Record<string, unknown>[];
    case "address":
      return { line1: "", city: "", region: "", postalCode: "", country: "" };
    case "captcha":
      return null;
    case "container":
      return {};
    case "number":
    case "currency":
    case "slider":
    case "rating":
      return "";
    default:
      return "";
  }
}

export function initialData(components: FormComponent[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const visit = (list: FormComponent[], target: Record<string, unknown>) => {
    for (const component of list) {
      if (component.type === "panel" || component.type === "fieldset" || component.type === "tabs" || component.type === "content" || component.type === "button" || component.type === "review" || component.type === "columns") {
        if (component.type === "columns") component.columns?.forEach((col) => visit(col.components, target));
        else childLists(component).forEach((children) => visit(children, target));
        continue;
      }
      if (component.type === "datagrid") {
        target[component.key] = [];
        continue;
      }
      if (component.type === "container") {
        const obj: Record<string, unknown> = {};
        visit(component.components ?? [], obj);
        target[component.key] = obj;
        continue;
      }
      target[component.key] = emptyValue(component);
    }
  };
  visit(components, data);
  return applyCalculations(components, data);
}

export function pageComponents(form: Pick<FormDefinition, "display" | "components">): FormComponent[] {
  if (form.display === "wizard") {
    const pages = wizardPages(form.components);
    if (pages.length > 0) return pages;
  }
  return form.components;
}

export function hashRequest(value: unknown): string {
  return JSON.stringify(value);
}
