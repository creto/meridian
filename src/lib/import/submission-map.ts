import { validateForm } from "../forms/engine.ts";
import { walkComponents } from "../forms/tree.ts";
import type { FormComponent, FormDefinition } from "../forms/types.ts";

export interface ColumnMapping {
  column: string;
  key: string;
}

export interface RejectedRow {
  index: number;
  errors: Record<string, string>;
}

export interface ImportBatch {
  accepted: { index: number; data: Record<string, unknown> }[];
  rejected: RejectedRow[];
}

function fold(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s_\-]+/g, "");
}

function fieldTypes(components: FormComponent[]): Map<string, FormComponent["type"]> {
  const types = new Map<string, FormComponent["type"]>();
  walkComponents(components, ({ component }) => {
    if (component.key) types.set(component.key, component.type);
  });
  return types;
}

/** Match spreadsheet headers to form keys. Exact, then case-insensitive, then punctuation-folded. Unmatched columns are omitted. */
export function suggestMappings(columns: string[], keys: string[]): ColumnMapping[] {
  const used = new Set<string>();
  const mappings: ColumnMapping[] = [];
  for (const column of columns) {
    const exact = keys.find((key) => key === column && !used.has(key));
    const insensitive = exact ?? keys.find((key) => key.toLowerCase() === column.toLowerCase() && !used.has(key));
    const folded = insensitive ?? keys.find((key) => fold(key) === fold(column) && !used.has(key));
    if (!folded) continue;
    used.add(folded);
    mappings.push({ column, key: folded });
  }
  return mappings;
}

function coerce(value: string, type: FormComponent["type"] | undefined): unknown {
  const text = value.trim();
  if (text === "") return null;
  if (type === "number" || type === "currency" || type === "slider" || type === "rating") {
    const numeric = Number(text.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : text;
  }
  if (type === "checkbox" || type === "toggle") {
    const token = text.toLowerCase();
    if (["true", "yes", "1", "y"].includes(token)) return true;
    if (["false", "no", "0", "n"].includes(token)) return false;
  }
  return text;
}

export function mapRow(row: Record<string, string>, mappings: ColumnMapping[], types: Map<string, FormComponent["type"]>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const mapping of mappings) {
    if (!Object.prototype.hasOwnProperty.call(row, mapping.column)) continue;
    data[mapping.key] = coerce(row[mapping.column] ?? "", types.get(mapping.key));
  }
  return data;
}

/**
 * Validate a batch before any row is written. Accepted rows are the ones a caller may submit.
 * Rejected rows stay in the report so a partial import can be retried.
 */
export function importSubmissionRows(form: FormDefinition, rows: Record<string, string>[], mappings: ColumnMapping[]): ImportBatch {
  const types = fieldTypes(form.components);
  const accepted: ImportBatch["accepted"] = [];
  const rejected: RejectedRow[] = [];
  rows.forEach((row, index) => {
    const data = mapRow(row, mappings, types);
    const errors = validateForm(form, data);
    if (Object.keys(errors).length) rejected.push({ index, errors });
    else accepted.push({ index, data });
  });
  return { accepted, rejected };
}
