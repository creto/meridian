import { applyOperations, normalizeOperations, type ModelOperation } from "../forms/llm.ts";
import { compileExpression } from "../forms/expressions.ts";
import { collectKeys, walkComponents } from "../forms/tree.ts";
import type { ComponentType, FormComponent, FormDefinition } from "../forms/types.ts";
import { validateWorkflow } from "../workflow/graph.ts";

const TYPES = new Set<ComponentType>([
  "textfield", "textarea", "number", "password", "email", "phone", "url", "hidden",
  "select", "radio", "checkbox", "selectboxes", "toggle", "datetime", "date", "time",
  "currency", "slider", "rating", "content", "panel", "columns", "fieldset", "tabs",
  "datagrid", "container", "file", "signature", "address", "button", "review",
]);

const OPS = new Set(["add", "update", "remove", "replace", "display", "workflow"]);

export interface PatchVerdict {
  ok: boolean;
  issues: string[];
  operations: ModelOperation[];
}

function expressionIssue(label: string, source: string | undefined, issues: string[]) {
  if (!source) return;
  const compiled = compileExpression(source);
  if (!compiled.ok) issues.push(`${label}: ${compiled.error}`);
}

function inspectComponent(component: FormComponent, issues: string[], seen: Set<string>) {
  if (!TYPES.has(component.type)) issues.push(`Unsupported component type ${component.type}`);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(component.key)) issues.push(`Key ${component.key} is not a safe identifier`);
  if (seen.has(component.key)) issues.push(`Duplicate key ${component.key}`);
  seen.add(component.key);
  expressionIssue(component.key, component.conditional, issues);
  expressionIssue(component.key, component.calculateValue, issues);
  if (component.validate?.pattern) {
    try {
      RegExp(component.validate.pattern);
    } catch {
      issues.push(`${component.key} has an invalid pattern`);
    }
  }
  for (const child of component.components ?? []) inspectComponent(child, issues, seen);
  for (const column of component.columns ?? []) {
    for (const child of column.components) inspectComponent(child, issues, seen);
  }
}

/**
 * Validate an AI patch before it is applied to a published form.
 * The returned operations are the normalized set; the caller still decides whether to apply them.
 */
export function validateAiPatch(form: FormDefinition, raw: unknown): PatchVerdict {
  const operations = normalizeOperations(raw);
  const issues: string[] = [];
  if (!Array.isArray(raw)) issues.push("Operations must be an array");
  for (const operation of operations) {
    if (!OPS.has(operation.op)) issues.push(`Unknown operation ${operation.op}`);
    expressionIssue(operation.match ?? operation.op, operation.conditional, issues);
    expressionIssue(operation.match ?? operation.op, operation.calculateValue, issues);
    if (operation.op === "add" && !operation.component) issues.push("Add operation is missing a component");
    if ((operation.op === "update" || operation.op === "remove") && !operation.match) issues.push(`${operation.op} is missing a match`);
    if (operation.workflow) {
      for (const issue of validateWorkflow(operation.workflow)) issues.push(issue.message);
    }
  }
  const applied = applyOperations(structuredClone(form.components), operations);
  issues.push(...applied.issues);
  const seen = new Set<string>();
  for (const component of applied.components) inspectComponent(component, issues, seen);
  if (applied.workflow) {
    for (const issue of validateWorkflow(applied.workflow)) issues.push(issue.message);
  }
  const keys = collectKeys(applied.components);
  if (keys.length !== seen.size) issues.push("Component keys diverged during validation");
  walkComponents(applied.components, () => undefined);
  return { ok: issues.length === 0, issues, operations };
}
