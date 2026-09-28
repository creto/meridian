import { calculationCycles, isVisible } from "./engine.ts";
import { compileExpression, referencedKeys } from "./expressions.ts";
import { lintForm } from "./lint.ts";
import { walkComponents } from "./tree.ts";
import type { ComponentType, FormComponent, FormDefinition } from "./types.ts";

type ExpressionAst = Extract<ReturnType<typeof compileExpression>, { ok: true }>["ast"];

export interface CompiledField {
  key: string;
  type: ComponentType;
  required: boolean;
  conditionalAst: ExpressionAst | null;
  calculateAst: ExpressionAst | null;
  pattern?: string;
  dependencies: string[];
  /** Set when conditional or calculateValue fails to compile. The form still compiles. */
  error?: string;
  /** Visibility with an empty submission. Data-dependent rules are still compiled. */
  visibleWithEmptyData: boolean;
}

export interface CompiledIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface CompiledForm {
  formId: string;
  version: number;
  display: FormDefinition["display"];
  fields: CompiledField[];
  cycles: string[][];
  issues: CompiledIssue[];
  compiledAt: string;
}

const MAX_COMPILED = 100;
const compiledCache = new Map<string, CompiledForm>();

function uniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** djb2 plus a second rolling mix so the cache key is short but not a single 32-bit fold. */
function hashString(input: string): string {
  let a = 5381;
  let b = 52711;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    a = ((a << 5) + a + code) | 0;
    b = ((b << 5) + b) ^ code;
  }
  return `${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}

function cacheKey(form: FormDefinition): string {
  return `${form.id}:${form.version}:${hashString(JSON.stringify(form.components))}`;
}

function compileOne(component: FormComponent): CompiledField {
  let conditionalAst: ExpressionAst | null = null;
  let calculateAst: ExpressionAst | null = null;
  const errors: string[] = [];

  if (component.conditional) {
    const compiled = compileExpression(component.conditional);
    if (compiled.ok) conditionalAst = compiled.ast;
    else errors.push(compiled.error);
  }
  if (component.calculateValue) {
    const compiled = compileExpression(component.calculateValue);
    if (compiled.ok) calculateAst = compiled.ast;
    else errors.push(compiled.error);
  }

  const dependencies = uniqueKeys([
    ...referencedKeys(component.conditional ?? ""),
    ...referencedKeys(component.calculateValue ?? ""),
  ]);

  const field: CompiledField = {
    key: component.key,
    type: component.type,
    required: component.required === true,
    conditionalAst,
    calculateAst,
    pattern: component.validate?.pattern,
    dependencies,
    visibleWithEmptyData: isVisible(component, {}),
  };
  if (errors.length > 0) field.error = errors.join("; ");
  return field;
}

export function compileForm(form: FormDefinition): CompiledForm {
  const fields: CompiledField[] = [];
  walkComponents(form.components, ({ component }) => {
    fields.push(compileOne(component));
  });
  const issues = lintForm(form).map(({ level, code, message }) => ({ level, code, message }));
  return {
    formId: form.id,
    version: form.version,
    display: form.display,
    fields,
    cycles: calculationCycles(form.components),
    issues,
    compiledAt: new Date().toISOString(),
  };
}

export function getCompiledForm(form: FormDefinition): CompiledForm {
  const key = cacheKey(form);
  const hit = compiledCache.get(key);
  if (hit) return hit;
  const compiled = compileForm(form);
  compiledCache.set(key, compiled);
  while (compiledCache.size > MAX_COMPILED) {
    const oldest = compiledCache.keys().next().value;
    if (oldest === undefined) break;
    compiledCache.delete(oldest);
  }
  return compiled;
}

export function invalidateCompiled(formId: string): void {
  if (!formId) return;
  const prefix = `${formId}:`;
  const doomed: string[] = [];
  for (const key of compiledCache.keys()) {
    if (key.startsWith(prefix)) doomed.push(key);
  }
  for (const key of doomed) compiledCache.delete(key);
}
