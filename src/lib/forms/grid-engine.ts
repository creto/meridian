import { evaluate, referencedKeys } from "./expressions.ts";

export type GridValue = string | number | boolean | null;
export type GridRow = Record<string, GridValue>;
export type SortDirection = "asc" | "desc";
export type AggregateOp = "sum" | "avg" | "min" | "max" | "count";

export interface GridColumn {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean";
  formula?: string;
}

export interface CrossRowRule {
  expression: string;
  message: string;
}

export interface RowFormulaResult {
  row: GridRow;
  errors: Record<string, string>;
}

const RESERVED = new Set(["data", "row", "rows", "value", "true", "false", "null"]);

function compareValues(left: GridValue | undefined, right: GridValue | undefined): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export function sortRows(rows: GridRow[], key: string, direction: SortDirection = "asc"): GridRow[] {
  const factor = direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const delta = compareValues(a.row[key], b.row[key]);
      return delta === 0 ? a.index - b.index : delta * factor;
    })
    .map((item) => item.row);
}

export function filterRows(rows: GridRow[], query: string, keys?: string[]): GridRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows.slice();
  return rows.filter((row) => {
    const fields = keys ?? Object.keys(row);
    return fields.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
  });
}

export function reorderRow(rows: GridRow[], from: number, to: number): GridRow[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error("Row indexes must be integers");
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) throw new Error("Row index is out of range");
  const next = rows.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return next;
  next.splice(to, 0, moved);
  return next;
}

function parseCell(raw: string, type: GridColumn["type"] | undefined): GridValue {
  const text = raw.trim();
  if (text === "") return null;
  if (type === "number") {
    const value = Number(text.replace(/,/g, ""));
    return Number.isFinite(value) ? value : text;
  }
  if (type === "boolean") {
    const token = text.toLowerCase();
    if (token === "true" || token === "yes" || token === "1") return true;
    if (token === "false" || token === "no" || token === "0") return false;
    return text;
  }
  return text;
}

/** Paste a TSV/CSV block into a rectangular window. Extra rows are appended. */
export function pasteBlock(rows: GridRow[], columns: GridColumn[], startRow: number, startCol: number, text: string): GridRow[] {
  if (!Number.isInteger(startRow) || startRow < 0) throw new Error("startRow is out of range");
  if (!Number.isInteger(startCol) || startCol < 0 || startCol >= columns.length) throw new Error("startCol is out of range");
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const next = rows.map((row) => ({ ...row }));
  lines.forEach((line, rowOffset) => {
    const cells = line.split("\t");
    const index = startRow + rowOffset;
    while (next.length <= index) next.push({});
    const target = next[index] ?? {};
    cells.forEach((cell, colOffset) => {
      const column = columns[startCol + colOffset];
      if (!column || column.formula) return;
      target[column.key] = parseCell(cell, column.type);
    });
    next[index] = target;
  });
  return next;
}

export function columnAggregate(rows: GridRow[], key: string, op: AggregateOp): number {
  if (op === "count") return rows.filter((row) => row[key] != null && row[key] !== "").length;
  const numbers = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numbers.length) return 0;
  if (op === "sum") return numbers.reduce((sum, value) => sum + value, 0);
  if (op === "avg") return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  if (op === "min") return Math.min(...numbers);
  return Math.max(...numbers);
}

function formulaDeps(column: GridColumn, known: Set<string>): string[] {
  if (!column.formula) return [];
  return referencedKeys(column.formula).filter((key) => known.has(key) && !RESERVED.has(key));
}

/** Topological order of calculated columns. Cycles are listed and excluded. */
export function formulaOrder(columns: GridColumn[]): { order: string[]; cycles: string[] } {
  const known = new Set(columns.map((column) => column.key));
  const deps = new Map<string, string[]>();
  for (const column of columns) {
    if (column.formula) deps.set(column.key, formulaDeps(column, known));
  }
  const state = new Map<string, "visiting" | "done">();
  const order: string[] = [];
  const cycles = new Set<string>();
  const visit = (key: string) => {
    const mark = state.get(key);
    if (mark === "done") return;
    if (mark === "visiting") {
      cycles.add(key);
      return;
    }
    state.set(key, "visiting");
    for (const dep of deps.get(key) ?? []) {
      if (cycles.has(dep) || !deps.has(dep)) continue;
      visit(dep);
      if (cycles.has(dep)) cycles.add(key);
    }
    if (state.get(key) === "visiting" && !cycles.has(key)) {
      state.set(key, "done");
      order.push(key);
    }
  };
  for (const key of deps.keys()) visit(key);
  return { order, cycles: [...cycles] };
}

export function applyRowFormulas(row: GridRow, columns: GridColumn[], allRows: GridRow[] = []): RowFormulaResult {
  const { order, cycles } = formulaOrder(columns);
  const next: GridRow = { ...row };
  const errors: Record<string, string> = {};
  for (const key of cycles) errors[key] = "Calculation cycle";
  const byKey = new Map(columns.map((column) => [column.key, column]));
  for (const key of order) {
    const column = byKey.get(key);
    if (!column?.formula || cycles.includes(key)) continue;
    const result = evaluate(column.formula, { ...next, row: next, rows: allRows, value: next[key] ?? null });
    if (!result.ok) {
      errors[key] = result.error;
      continue;
    }
    const value = result.value;
    if (value == null) next[key] = null;
    else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") next[key] = value;
    else errors[key] = "Formula did not return a scalar";
  }
  return { row: next, errors };
}

export function applyGridFormulas(rows: GridRow[], columns: GridColumn[]): { rows: GridRow[]; errors: Record<string, string>[] } {
  const errors: Record<string, string>[] = [];
  const computed = rows.map((row) => {
    const result = applyRowFormulas(row, columns, rows);
    errors.push(result.errors);
    return result.row;
  });
  return { rows: computed, errors };
}

export function validateCrossRow(rows: GridRow[], rules: CrossRowRule[]): { row: number; message: string }[] {
  const issues: { row: number; message: string }[] = [];
  rows.forEach((row, index) => {
    for (const rule of rules) {
      const result = evaluate(rule.expression, { row, rows, index, value: null });
      if (!result.ok) {
        issues.push({ row: index, message: result.error });
        continue;
      }
      if (!result.value) issues.push({ row: index, message: rule.message });
    }
  });
  return issues;
}

function csvCell(value: GridValue | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(columns: GridColumn[], rows: GridRow[]): string {
  const header = columns.map((column) => csvCell(column.label || column.key)).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(","));
  return [header, ...body].join("\n");
}

export function fromCsv(text: string): { columns: string[]; rows: GridRow[] } {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    if (row.length || cell) {
      pushCell();
      rows.push(row);
    }
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      pushCell();
      continue;
    }
    if (char === "\n") {
      pushRow();
      continue;
    }
    if (char === "\r") continue;
    cell += char;
  }
  if (cell.length || row.length) pushRow();
  const [header, ...body] = rows;
  if (!header?.length) return { columns: [], rows: [] };
  const columns = header.map((name, index) => name.trim() || `col_${index + 1}`);
  return {
    columns,
    rows: body.filter((line) => line.some((item) => item !== "")).map((line) => {
      const record: GridRow = {};
      columns.forEach((key, index) => {
        record[key] = line[index] ?? "";
      });
      return record;
    }),
  };
}

/** Virtual window over a tall grid. The UI paints only [start, end). */
export function visibleWindow(total: number, scrollTop: number, viewport: number, rowHeight: number, overscan = 4): { start: number; end: number; offsetY: number; totalHeight: number } {
  if (total < 0 || viewport < 0 || rowHeight <= 0) throw new Error("Invalid virtual window");
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(viewport / rowHeight) + overscan * 2;
  const end = Math.min(total, start + visible);
  return { start, end, offsetY: start * rowHeight, totalHeight: total * rowHeight };
}
