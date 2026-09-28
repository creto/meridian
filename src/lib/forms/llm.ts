import { compileExpression } from "./expressions.ts";
import { knownProperty, writeSetting } from "./formio/document.ts";
import { propertyGuide } from "./formio/adapter.ts";
import { generateFormFromText, normalizeAiComponents } from "./generate.ts";
import { newFormShell } from "./importing.ts";
import { uniqueKey } from "./ids.ts";
import { collectKeys, insertComponent, mapComponents, removeComponent, walkComponents } from "./tree.ts";
import type { FormComponent, FormDefinition, JsonValue, WorkflowDef, WorkflowNode } from "./types.ts";

export const FORM_RULES = `You design forms for Meridian. Return only a JSON object, no markdown.
Component types: textfield, textarea, number, email, phone, url, select, radio, checkbox, selectboxes, toggle, date, datetime, time, currency, file, signature, address, captcha, panel, datagrid, content, review.
Each component: type, key (camelCase), label, required (boolean), and when useful description, placeholder, conditional, calculateValue, values:[{label,value}], pattern, patternMessage.
Panels hold components. When the form has several sections, display is "wizard" and each panel is a page. Put a review panel last when there is more than one page.
conditional and calculateValue are safe expressions, never JavaScript. Examples: supplierType == "colombian_company" , paymentMethod == "transfer" , quantity * unitPrice. Operators: == != > < >= <= and or not. Functions: empty exists len IF SUM AVG MIN MAX COUNT round abs.
Choice fields must include values. Keys are stable identifiers; labels can be any language.
workflow, when a review path is requested: {"nodes":[{"id":"start","type":"start","title":"Submitted"},{"id":"review","type":"human","title":"Review","role":"Reviewer"},{"id":"done","type":"end","title":"Approved"},{"id":"rejected","type":"end","title":"Rejected"}],"edges":[{"from":"start","to":"review","when":"approved"},{"from":"review","to":"done","when":"approved"},{"from":"review","to":"rejected","when":"rejected"}]}.
Service nodes may only use service "pdf" or "archive". Do not claim a cloud store is connected.
Do not invent fields the user did not ask for, except a supplier-type choice when they contrast two kinds of answer, and a review page on a wizard.
Advanced Form.io settings are not a fixed list of nine. On an update operation you may include "formio": { "inputMask": "999", "clearOnHide": false, "prefix": "$" } using only property paths that exist for that component type. Do not invent paths. Safe expressions stay in conditional and calculateValue. Do not send JavaScript.`;

export function editSystemPrompt(): string {
  return `${EDIT_SYSTEM}\n\nProperty paths by component type:\n${propertyGuide()}`;
}

export const EDIT_SYSTEM = `${FORM_RULES}
You are editing an existing form. Understand the instruction in whatever language it uses, including follow-ups like "that one", "make it optional", or "also add a phone".
Prefer small operations. Use a full components array only when the structure itself must change (new pages, a redesign).
Return JSON:
{"reply":"what you understood, in the user's language","summary":["short change"],"display":null,"operations":[{"op":"update","match":"address","required":false},{"op":"add","parent":"Organization","component":{"type":"url","key":"website","label":"Website","conditional":"supplierType == \\"foreign\\""}},{"op":"remove","match":"phone"}]}
match must be an existing key or label copied from the form. If the user uses a nickname, choose the closest existing field and use that key. parent is a section key or label. Do not change fields the user did not mention. Keep existing keys.
If the user is only asking a question, return "operations":[] and answer in reply. Do not invent a change.`;

export const AGENT_SYSTEM = `${FORM_RULES}
You are Meridian's agent. The user speaks in ordinary language, in any language. Reply in that language, briefly, and do the work.
Return JSON: {"reply":"...","actions":[]}
Actions, only those the user actually asked for:
- {"type":"create_form","title":"...","description":"...","display":"form"|"wizard","components":[],"workflow":optional,"reply":"optional"}
- {"type":"edit_form","formId":"<id from the catalog>","summary":["..."],"operations":[]}
- {"type":"validate","formId":"<id>","data":{}} when the object should be checked and not saved.
- {"type":"submit","formId":"<id>","data":{},"idempotencyKey":"stable-slug"} ONLY when the user explicitly asks to submit, file, send, or register the record.
A created form is saved immediately and can be edited on a later turn by its id. Include every field the user named, with a fitting type (email, phone, date, file, currency, signature). Group into panels when there is more than one topic.
Use catalog keys and option values, never labels, in data. If a required visible field is missing, ask for that fact in reply and do not submit. Hidden conditional fields stay out of data. Repeat concrete field values in the reply so a later yes-submit still has them. actions is empty when you are only answering.
idempotencyKey is derived from the form name and a distinctive token in the request, so a retry hits the same key.`;

export const CREATE_SYSTEM = `${FORM_RULES}
Return {"title":"string","description":"string","display":"form"|"wizard","reply":"one or two sentences in the user's language naming the pages and any show-when rules","components":[],"workflow":optional}.
Group related fields into panels when there are more than six inputs or more than one topic. Write labels in the user's language. The reply is for a person, not a list of JSON keys.`;

export function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export function compactComponents(components: FormComponent[]): unknown[] {
  return components.map((component) => {
    const row: Record<string, unknown> = {
      type: component.type,
      key: component.key,
      label: component.label,
    };
    if (component.required) row.required = true;
    if (component.conditional) row.conditional = component.conditional;
    if (component.calculateValue) row.calculateValue = component.calculateValue;
    if (component.placeholder) row.placeholder = component.placeholder;
    if (component.description) row.description = component.description;
    if (component.hidden) row.hidden = true;
    if (component.values?.length) row.values = component.values;
    if (component.validate?.pattern) row.pattern = component.validate.pattern;
    if (component.components?.length) row.components = compactComponents(component.components);
    return row;
  });
}

export interface ModelField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  conditional?: string;
  values?: string[];
  columns?: string[];
}

export interface ModelForm {
  id: string;
  name: string;
  title: string;
  description: string;
  display: "form" | "wizard";
  status: string;
  fields: ModelField[];
}

const LAYOUT = new Set(["panel", "columns", "fieldset", "tabs", "content", "button", "review"]);

export function modelCatalog(forms: FormDefinition[]): ModelForm[] {
  return forms
    .filter((form) => form.status !== "archived")
    .slice(0, 12)
    .map((form) => {
      const fields: ModelField[] = [];
      walkComponents(form.components, ({ component, parent }) => {
        if (parent?.type === "datagrid" || parent?.type === "container") return;
        if (LAYOUT.has(component.type)) return;
        const field: ModelField = {
          key: component.key,
          label: component.label,
          type: component.type,
          required: !!component.required,
        };
        if (component.conditional) field.conditional = component.conditional;
        if (component.values?.length) field.values = component.values.slice(0, 12).map((item) => `${item.value} = ${item.label}`);
        if (component.type === "datagrid") field.columns = (component.components ?? []).map((child) => child.key);
        fields.push(field);
      });
      return {
        id: form.id,
        name: form.name,
        title: form.title,
        description: form.description.slice(0, 200),
        display: form.display,
        status: form.status,
        fields: fields.slice(0, 80),
      };
    });
}

function patternOk(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeTree(components: FormComponent[]): { components: FormComponent[]; issues: string[] } {
  const issues: string[] = [];
  const walk = (list: FormComponent[]): FormComponent[] =>
    list.map((component) => {
      const next: FormComponent = { ...component };
      if (next.conditional) {
        const compiled = compileExpression(next.conditional);
        if (!compiled.ok) {
          issues.push(`Removed the show-when rule on ${next.label}: ${compiled.error}`);
          next.conditional = undefined;
        }
      }
      if (next.calculateValue) {
        const compiled = compileExpression(next.calculateValue);
        if (!compiled.ok) {
          issues.push(`Removed the calculation on ${next.label}: ${compiled.error}`);
          next.calculateValue = undefined;
        }
      }
      if (next.validate?.pattern && !patternOk(next.validate.pattern)) {
        issues.push(`Removed the pattern on ${next.label}`);
        next.validate = { ...next.validate, pattern: undefined };
      }
      if (next.components) next.components = walk(next.components);
      if (next.columns) next.columns = next.columns.map((col) => ({ ...col, components: walk(col.components) }));
      return next;
    });
  return { components: walk(components), issues };
}

export function normalizeWorkflow(raw: unknown): WorkflowDef | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(record.nodes)) return undefined;
  const nodes: WorkflowNode[] = [];
  for (const node of record.nodes.slice(0, 16)) {
    if (!node || typeof node !== "object") continue;
    const source = node as Record<string, unknown>;
    const id = String(source.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (!id) continue;
    let type = String(source.type ?? "human");
    if (type === "approval" || type === "decision") type = "human";
    if (type !== "start" && type !== "human" && type !== "service" && type !== "end") continue;
    const title = String(source.title ?? id).slice(0, 80);
    const item: WorkflowNode = { id, type, title };
    if (typeof source.role === "string" && source.role.trim()) item.role = source.role.trim().slice(0, 40);
    if (type === "service") {
      item.service = source.service === "pdf" || /pdf/i.test(title) ? "pdf" : "archive";
    }
    nodes.push(item);
  }
  if (!nodes.some((node) => node.type === "start") || !nodes.some((node) => node.type === "end")) return undefined;
  const ids = new Set(nodes.map((node) => node.id));
  const edges: WorkflowDef["edges"] = [];
  if (Array.isArray(record.edges)) {
    for (const edge of record.edges.slice(0, 32)) {
      if (!edge || typeof edge !== "object") continue;
      const source = edge as Record<string, unknown>;
      const from = String(source.from ?? "");
      const to = String(source.to ?? "");
      if (!ids.has(from) || !ids.has(to)) continue;
      edges.push({ from, to, when: typeof source.when === "string" ? source.when.slice(0, 160) : "approved" });
    }
  }
  if (!edges.length) return undefined;
  return { nodes, edges };
}

function strings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 240)).slice(0, limit);
}

function findMatches(components: FormComponent[], match: string): FormComponent[] {
  const needle = match.trim().toLowerCase();
  if (!needle) return [];
  const exact: FormComponent[] = [];
  const partial: FormComponent[] = [];
  walkComponents(components, ({ component }) => {
    const label = component.label.toLowerCase();
    const key = component.key.toLowerCase();
    if (label === needle || key === needle) exact.push(component);
    else if (label.includes(needle) || key.includes(needle) || needle.includes(label)) partial.push(component);
  });
  return exact.length ? exact : partial;
}

function readValues(value: unknown): { label: string; value: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value.slice(0, 30).map((item) => {
    const opt = item as { label?: string; value?: string };
    return { label: String(opt.label ?? opt.value ?? ""), value: String(opt.value ?? opt.label ?? "") };
  }).filter((opt) => opt.value);
  return options.length ? options : undefined;
}

export interface ModelOperation {
  op: string;
  match?: string;
  parent?: string;
  label?: string;
  required?: boolean;
  hidden?: boolean;
  conditional?: string;
  calculateValue?: string;
  clearConditional?: boolean;
  placeholder?: string;
  description?: string;
  pattern?: string;
  patternMessage?: string;
  display?: "form" | "wizard";
  values?: { label: string; value: string }[];
  formio?: { [key: string]: JsonValue };
  component?: FormComponent;
  components?: FormComponent[];
  workflow?: WorkflowDef;
}

type JsonLeaf = string | number | boolean | null;
export type SubmissionData = Record<string, JsonLeaf | JsonLeaf[] | Record<string, JsonLeaf> | Array<Record<string, JsonLeaf>>>;

function leaf(value: unknown): JsonLeaf | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 2000);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

export function coerceData(value: unknown): SubmissionData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data: SubmissionData = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    const simple = leaf(raw);
    if (simple !== undefined) {
      data[key] = simple;
      continue;
    }
    if (Array.isArray(raw)) {
      const objects = raw.slice(0, 40).map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const row: Record<string, JsonLeaf> = {};
        for (const [child, cell] of Object.entries(item as Record<string, unknown>).slice(0, 20)) {
          const boxed = leaf(cell);
          if (boxed !== undefined) row[child] = boxed;
        }
        return row;
      }).filter((item): item is Record<string, JsonLeaf> => !!item);
      if (objects.length) data[key] = objects;
      continue;
    }
    if (raw && typeof raw === "object") {
      const row: Record<string, JsonLeaf> = {};
      for (const [child, cell] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
        const boxed = leaf(cell);
        if (boxed !== undefined) row[child] = boxed;
      }
      if (Object.keys(row).length) data[key] = row;
    }
  }
  return data;
}

export function normalizeOperations(raw: unknown): ModelOperation[] {
  if (!Array.isArray(raw)) return [];
  const operations: ModelOperation[] = [];
  for (const item of raw.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const op: ModelOperation = { op: String(source.op ?? source.type ?? "").slice(0, 40) };
    if (!op.op) continue;
    if (typeof source.match === "string") op.match = source.match.slice(0, 120);
    else if (typeof source.key === "string") op.match = source.key.slice(0, 120);
    else if (typeof source.label === "string" && op.op !== "add") op.match = source.label.slice(0, 120);
    if (typeof source.parent === "string") op.parent = source.parent.slice(0, 120);
    if (typeof source.label === "string") op.label = source.label.slice(0, 120);
    if (typeof source.required === "boolean") op.required = source.required;
    if (typeof source.hidden === "boolean") op.hidden = source.hidden;
    if (typeof source.conditional === "string") op.conditional = source.conditional.slice(0, 300);
    if (source.conditional === null || source.clearConditional === true) op.clearConditional = true;
    if (typeof source.calculateValue === "string") op.calculateValue = source.calculateValue.slice(0, 300);
    if (typeof source.placeholder === "string") op.placeholder = source.placeholder.slice(0, 120);
    if (typeof source.description === "string") op.description = source.description.slice(0, 400);
    if (typeof source.pattern === "string") op.pattern = source.pattern.slice(0, 200);
    if (typeof source.patternMessage === "string") op.patternMessage = source.patternMessage.slice(0, 160);
    if (source.display === "form" || source.display === "wizard") op.display = source.display;
    const values = readValues(source.values);
    if (values) op.values = values;
    if (source.formio && typeof source.formio === "object" && !Array.isArray(source.formio)) {
      op.formio = Object.fromEntries(Object.entries(source.formio as Record<string, unknown>).slice(0, 40)) as { [key: string]: JsonValue };
    }
    if (source.component && typeof source.component === "object") {
      const built = normalizeAiComponents({ components: [source.component] })[0];
      if (built) op.component = sanitizeTree([built]).components[0];
    }
    if (Array.isArray(source.components)) {
      const built = sanitizeTree(normalizeAiComponents({ components: source.components })).components;
      if (built.length) op.components = built;
    }
    if (source.workflow) {
      const workflow = normalizeWorkflow(source.workflow);
      if (workflow) op.workflow = workflow;
    }
    operations.push(op);
  }
  return operations;
}

export function applyOperations(components: FormComponent[], operations: unknown[]): { components: FormComponent[]; issues: string[]; display?: "form" | "wizard"; workflow?: WorkflowDef } {
  let current = structuredClone(components);
  const issues: string[] = [];
  let display: "form" | "wizard" | undefined;
  let workflow: WorkflowDef | undefined;

  const place = (component: FormComponent, parentName: unknown) => {
    const taken = new Set(collectKeys(current));
    if (taken.has(component.key)) component.key = uniqueKey(component.key, taken);
    const parent = typeof parentName === "string" ? findMatches(current, parentName).find((item) => item.components) : undefined;
    if (parent) {
      current = mapComponents(current, (item) => (item.id === parent.id ? { ...item, components: [...(item.components ?? []), component] } : item));
      return;
    }
    const panels = current.filter((item) => item.type === "panel" && item.key !== "review");
    const target = panels[panels.length - 1];
    if (target) {
      current = current.map((item) => (item.id === target.id ? { ...item, components: [...(item.components ?? []), component] } : item));
      return;
    }
    current = insertComponent(current, component, null, 999);
  };

  for (const operation of operations.slice(0, 40)) {
    if (!operation || typeof operation !== "object") continue;
    const op = operation as unknown as Record<string, unknown>;
    const kind = String(op.op ?? op.type ?? "");
    if (kind === "replace" && Array.isArray(op.components)) {
      const next = normalizeAiComponents({ components: op.components });
      if (next.length) current = next;
      else issues.push("The replacement field list was empty.");
      continue;
    }
    if (kind === "display" && (op.display === "form" || op.display === "wizard")) {
      display = op.display;
      continue;
    }
    if (kind === "workflow") {
      const next = normalizeWorkflow(op.workflow);
      if (next) workflow = next;
      else issues.push("That workflow could not be used.");
      continue;
    }
    const match = String(op.match ?? op.key ?? op.label ?? "");
    if (kind === "add") {
      const built = normalizeAiComponents({ components: [op.component] });
      const component = built[0];
      if (!component) {
        issues.push("Couldn't add that field.");
        continue;
      }
      place(component, op.parent);
      continue;
    }
    const matches = findMatches(current, match);
    if (matches.length !== 1) {
      issues.push(matches.length === 0 ? `Couldn't find “${match}”.` : `“${match}” matches more than one field.`);
      continue;
    }
    const target = matches[0]!;
    if (kind === "remove") {
      current = removeComponent(current, target.id);
      continue;
    }
    if (kind === "move") {
      const copy = structuredClone(target);
      current = removeComponent(current, target.id);
      place(copy, op.parent);
      continue;
    }
    if (kind === "update") {
      if (typeof op.conditional === "string" && !compileExpression(op.conditional).ok) {
        issues.push(`Kept the current rule on ${target.label}.`);
        op.conditional = undefined;
      }
      if (typeof op.calculateValue === "string" && !compileExpression(op.calculateValue).ok) {
        issues.push(`Kept the current calculation on ${target.label}.`);
        op.calculateValue = undefined;
      }
      if (typeof op.pattern === "string" && !patternOk(op.pattern)) {
        issues.push(`Kept the current pattern on ${target.label}.`);
        op.pattern = undefined;
      }
      if (op.formio && typeof op.formio === "object" && !Array.isArray(op.formio)) {
        for (const path of Object.keys(op.formio as Record<string, unknown>)) {
          if (path !== "type" && !knownProperty(target, path)) issues.push(`“${path}” is not a ${target.type} setting.`);
        }
      }
      current = mapComponents(current, (component) => {
        if (component.id !== target.id) return component;
        const next = { ...component };
        if (typeof op.required === "boolean") next.required = op.required;
        if (typeof op.hidden === "boolean") next.hidden = op.hidden;
        if (typeof op.label === "string" && op.label.trim()) next.label = op.label.trim().slice(0, 120);
        if (typeof op.placeholder === "string") next.placeholder = op.placeholder.slice(0, 120);
        if (typeof op.description === "string") next.description = op.description.slice(0, 400);
        if (typeof op.conditional === "string") next.conditional = op.conditional.slice(0, 300);
        if (op.conditional === null || op.clearConditional === true) next.conditional = undefined;
        if (typeof op.calculateValue === "string") next.calculateValue = op.calculateValue.slice(0, 300);
        const values = readValues(op.values);
        if (values) next.values = values;
        if (typeof op.pattern === "string") {
          next.validate = { ...(next.validate ?? {}), pattern: op.pattern.slice(0, 200), patternMessage: typeof op.patternMessage === "string" ? op.patternMessage.slice(0, 160) : next.validate?.patternMessage };
        }
        const formioPatch = op.formio;
        if (formioPatch && typeof formioPatch === "object" && !Array.isArray(formioPatch)) {
          let patched = next;
          for (const [path, value] of Object.entries(formioPatch as Record<string, unknown>)) {
            if (path !== "type" && !knownProperty(patched, path)) continue;
            patched = writeSetting(patched, path, value);
          }
          return patched;
        }
        return next;
      });
      continue;
    }
    issues.push(`Unknown change “${kind}”.`);
  }

  return { components: current, issues, display, workflow };
}

export interface EditProposal {
  valid: boolean;
  reply: string;
  summary: string[];
  issues: string[];
  title: string;
  description: string;
  display: "form" | "wizard";
  components: FormComponent[];
  workflow?: WorkflowDef;
}

export function proposalFromModel(form: FormDefinition, parsed: unknown): EditProposal {
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const summary = strings(record.summary, 12);
  let components = form.components;
  let display = form.display;
  let title = form.title;
  let description = form.description;
  let workflow = form.workflow;
  const issues = strings(record.notes, 8);

  if (record.display === "wizard" || record.display === "form") display = record.display;
  if (typeof record.title === "string" && record.title.trim()) title = record.title.trim().slice(0, 120);
  if (typeof record.description === "string") description = record.description.slice(0, 400);
  if (Array.isArray(record.components) && record.components.length) {
    const next = normalizeAiComponents({ components: record.components });
    if (next.length) components = next;
    else issues.push("The new field list was empty, so the current fields stay.");
  }
  if (Array.isArray(record.operations) && record.operations.length) {
    const applied = applyOperations(components, normalizeOperations(record.operations));
    components = applied.components;
    issues.push(...applied.issues);
    if (applied.display) display = applied.display;
    if (applied.workflow) workflow = applied.workflow;
  }
  if (record.workflow && typeof record.workflow === "object") {
    const next = normalizeWorkflow(record.workflow);
    if (next) workflow = next;
    else issues.push("The workflow was not usable, so the current one stays.");
  }
  const clean = sanitizeTree(components);
  components = clean.components;
  issues.push(...clean.issues);

  const changed =
    display !== form.display ||
    title !== form.title ||
    description !== form.description ||
    JSON.stringify(compactComponents(components)) !== JSON.stringify(compactComponents(form.components)) ||
    JSON.stringify(workflow ?? null) !== JSON.stringify(form.workflow ?? null);
  const reply = typeof record.reply === "string" && record.reply.trim()
    ? record.reply.trim().slice(0, 2000)
    : summary.join(" ") || (changed ? "Here is the change." : "I need a more specific change.");

  return {
    valid: changed,
    reply,
    summary: summary.length ? summary : changed ? ["Updated the form"] : [],
    issues,
    title,
    description,
    display,
    components,
    workflow,
  };
}

export function formFromModel(prompt: string, parsed: unknown): FormDefinition | null {
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const components = normalizeAiComponents(record);
  if (!components.length) return null;
  const clean = sanitizeTree(components);
  const workflow = record.workflow ? normalizeWorkflow(record.workflow) : undefined;
  const display = record.display === "wizard" || record.display === "form"
    ? record.display
    : components.every((component) => component.type === "panel")
      ? "wizard"
      : "form";
  const wantsArchive = /pdf|archive|ecm|archivo/i.test(prompt);
  return newFormShell({
    title: typeof record.title === "string" && record.title.trim() ? record.title.trim().slice(0, 120) : "Generated form",
    description: typeof record.description === "string" && record.description.trim() ? record.description.trim().slice(0, 400) : prompt.trim().slice(0, 280),
    display,
    components: clean.components,
    workflow,
    storage: wantsArchive
      ? { provider: "workspace-archive", connected: true, pathTemplate: "/forms/{{submission.id}}/", note: "The filled PDF is stored in the workspace archive. Other providers are not connected." }
      : undefined,
    tags: ["ai"],
    source: "grok",
    activity: [{ at: new Date().toISOString(), actor: "Grok", message: "Generated from a description" }],
  });
}

export interface AgentActionCreate {
  type: "create_form";
  form: FormDefinition;
}
export interface AgentActionEdit {
  type: "edit_form";
  formId: string;
  summary: string[];
  operations?: ModelOperation[];
  components?: FormComponent[];
  display?: "form" | "wizard";
  title?: string;
  description?: string;
  workflow?: WorkflowDef;
}
export interface AgentActionSubmit {
  type: "submit" | "validate";
  formId: string;
  data: SubmissionData;
  idempotencyKey?: string;
}
export type AgentAction = AgentActionCreate | AgentActionEdit | AgentActionSubmit;

function asData(value: unknown): SubmissionData | null {
  return coerceData(value);
}

export function actionsFromModel(parsed: unknown, prompt: string): { reply: string; actions: AgentAction[] } {
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const reply = typeof record.reply === "string" ? record.reply.trim().slice(0, 4000) : "";
  const actions: AgentAction[] = [];
  const list = Array.isArray(record.actions) ? record.actions.slice(0, 6) : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const action = item as Record<string, unknown>;
    const type = String(action.type ?? "");
    if (type === "create_form") {
      const form = formFromModel(prompt, action);
      if (form) actions.push({ type: "create_form", form });
      continue;
    }
    if (type === "edit_form") {
      const formId = String(action.formId ?? action.formName ?? action.name ?? "");
      if (!formId) continue;
      const edit: AgentActionEdit = { type: "edit_form", formId, summary: strings(action.summary, 8) };
      if (typeof action.title === "string") edit.title = action.title.slice(0, 120);
      if (typeof action.description === "string") edit.description = action.description.slice(0, 400);
      if (action.display === "form" || action.display === "wizard") edit.display = action.display;
      if (Array.isArray(action.components) && action.components.length) {
        const components = sanitizeTree(normalizeAiComponents({ components: action.components })).components;
        if (components.length) edit.components = components;
      }
      if (Array.isArray(action.operations)) edit.operations = normalizeOperations(action.operations);
      const workflow = action.workflow ? normalizeWorkflow(action.workflow) : undefined;
      if (workflow) edit.workflow = workflow;
      actions.push(edit);
      continue;
    }
    if (type === "submit" || type === "validate") {
      const data = asData(action.data);
      const formId = String(action.formId ?? action.formName ?? "");
      if (!data || !formId) continue;
      actions.push({
        type,
        formId,
        data,
        idempotencyKey: typeof action.idempotencyKey === "string" ? action.idempotencyKey.slice(0, 80) : undefined,
      });
    }
  }
  return { reply: reply || (actions.length ? "Done." : "I need a clearer request."), actions };
}

export function localAgent(message: string, forms: FormDefinition[]): { reply: string; actions: AgentAction[] } {
  const text = message.trim();
  const catalog = modelCatalog(forms);
  const mentioned = catalog.find((form) => text.toLowerCase().includes(form.title.toLowerCase()) || text.toLowerCase().includes(form.name.toLowerCase()));
  const asking = /\b(what|which|when|who|why|how|list|show|required|obligat|cu[aá]l|qu[eé]|cu[aá]ndo|explica|explain)\b/i.test(text);
  if (asking) {
    const form = mentioned ?? catalog[0];
    if (!form) return { reply: "There are no forms in this workspace yet. Ask me to design one.", actions: [] };
    const lines = form.fields.map((field) => {
      const rule = field.conditional ? `, shown when ${field.conditional}` : "";
      const values = field.values?.length ? `, values ${field.values.join("; ")}` : "";
      return `${field.required ? "Required" : "Optional"}: ${field.label} (${field.key}, ${field.type}${rule}${values})`;
    });
    return {
      reply: `${form.title} has ${form.fields.length} inputs.\n${lines.join("\n")}\nThe live model is not available, so this is a direct reading of the form.`,
      actions: [],
    };
  }
  if (/\b(create|design|build|draft|diseñ|haz|hacer|nuevo formulario|new form|formulario)\b/i.test(text)) {
    const form = generateFormFromText(text);
    return {
      reply: `I drafted “${form.title}” on this device because Grok isn't available. Open it in the builder and adjust anything that looks off.`,
      actions: [{ type: "create_form", form }],
    };
  }
  return {
    reply: "Grok isn't available in this workspace, so I can list fields or draft a form from a description. I won't invent a submission from a sentence without the model.",
    actions: [],
  };
}

export function resolveForm(forms: FormDefinition[], idOrName: string): FormDefinition | undefined {
  const needle = idOrName.trim().toLowerCase();
  return forms.find((form) => form.id === idOrName || form.name.toLowerCase() === needle || form.title.toLowerCase() === needle);
}
