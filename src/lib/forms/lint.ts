import { calculationCycles } from "./engine.ts";
import { compileExpression } from "./expressions.ts";
import { isValidKey } from "./ids.ts";
import { isLayout, walkComponents } from "./tree.ts";
import type { FormComponent, FormDefinition } from "./types.ts";

export interface LintIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  componentId?: string;
}

export function lintForm(form: Pick<FormDefinition, "components" | "display" | "title" | "storage">): LintIssue[] {
  const issues: LintIssue[] = [];
  const spaces = new Map<string, Map<string, string>>();

  const visit = (list: FormComponent[], space: string) => {
    const bucket = spaces.get(space) ?? new Map<string, string>();
    spaces.set(space, bucket);
    for (const component of list) {
      if (component.type !== "content" && component.type !== "button" && component.type !== "review") {
        if (!component.key) {
          issues.push({ level: "error", code: "KEY_MISSING", message: `${component.label || component.type} has no key`, componentId: component.id });
        } else if (!isValidKey(component.key)) {
          issues.push({
            level: "error",
            code: "KEY_INVALID",
            message: `Key “${component.key}” should start with a letter and use only letters, numbers, and underscores`,
            componentId: component.id,
          });
        } else if (bucket.has(component.key)) {
          issues.push({
            level: "error",
            code: "KEY_DUPLICATE",
            message: `Key “${component.key}” is used more than once`,
            componentId: component.id,
          });
        } else bucket.set(component.key, component.id);
      }
      if (component.conditional) {
        const compiled = compileExpression(component.conditional);
        if (!compiled.ok) {
          issues.push({ level: "error", code: "CONDITIONAL", message: `${component.label}: ${compiled.error}`, componentId: component.id });
        }
      }
      if (component.calculateValue) {
        const compiled = compileExpression(component.calculateValue);
        if (!compiled.ok) {
          issues.push({ level: "error", code: "CALCULATION", message: `${component.label}: ${compiled.error}`, componentId: component.id });
        }
      }
      if (component.validate?.custom) {
        const compiled = compileExpression(component.validate.custom);
        if (!compiled.ok) {
          issues.push({ level: "error", code: "VALIDATION", message: `${component.label}: ${compiled.error}`, componentId: component.id });
        }
      }
      if (component.required && component.hidden) {
        issues.push({
          level: "error",
          code: "REQUIRED_HIDDEN",
          message: `${component.label} is required but permanently hidden`,
          componentId: component.id,
        });
      }
      if (component.legacyNote) {
        issues.push({
          level: "warning",
          code: "LEGACY_SCRIPT",
          message: `${component.label}: ${component.legacyNote}`,
          componentId: component.id,
        });
      }
      if (component.type === "datagrid") visit(component.components ?? [], `${space}/${component.key}`);
      else if (component.type === "container") visit(component.components ?? [], `${space}/${component.key}`);
      else if (component.type === "columns") component.columns?.forEach((col) => visit(col.components, space));
      else if (component.components && isLayout(component)) visit(component.components, space);
    }
  };
  visit(form.components, "root");

  for (const cycle of calculationCycles(form.components)) {
    issues.push({ level: "error", code: "CYCLE", message: `Calculation cycle: ${cycle.join(" → ")}` });
  }

  const labels = new Map<string, number>();
  let required = 0;
  let inputs = 0;
  walkComponents(form.components, ({ component }) => {
    if (!isLayout(component) && component.type !== "hidden") {
      inputs += 1;
      if (component.required) required += 1;
      const label = component.label.trim().toLowerCase();
      if (label) labels.set(label, (labels.get(label) ?? 0) + 1);
    }
  });
  if (inputs === 0) issues.push({ level: "warning", code: "EMPTY", message: "This form has no input fields" });
  if (required > 12) {
    issues.push({ level: "warning", code: "TOO_MANY_REQUIRED", message: `${required} required fields may reduce completion` });
  }
  for (const [label, count] of labels) {
    if (count > 1) issues.push({ level: "warning", code: "DUP_LABEL", message: `Label “${label}” appears ${count} times` });
  }
  if (!form.title.trim()) issues.push({ level: "error", code: "TITLE", message: "Title is required" });

  if (form.display === "wizard") {
    const pages = form.components.filter((c) => c.type === "panel" || c.type === "fieldset");
    if (pages.length < 2) {
      issues.push({ level: "warning", code: "WIZARD_PAGES", message: "Wizard display works best with two or more sections" });
    }
    for (const page of pages) {
      let pageInputs = 0;
      walkComponents(page.components ?? [], ({ component }) => {
        if (!isLayout(component)) pageInputs += 1;
      });
      if (pageInputs === 0 && page.type === "panel") {
        const onlyReview = (page.components ?? []).every((c) => c.type === "review" || c.type === "content");
        if (!onlyReview) issues.push({ level: "warning", code: "EMPTY_PAGE", message: `“${page.label}” has no fields`, componentId: page.id });
      }
    }
  }

  const hasFile = form.components.some((c) => {
    let found = false;
    walkComponents([c], ({ component }) => {
      if (component.type === "file" || component.type === "signature") found = true;
    });
    return found;
  });
  if (hasFile && form.storage && !form.storage.connected) {
    issues.push({
      level: "warning",
      code: "STORAGE",
      message: `${form.storage.provider} is declared. Pick a tested connection in the form storage settings or the archive step will stop.`,
    });
  }
  return issues;
}

export function lintBlocksPublish(issues: LintIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}
