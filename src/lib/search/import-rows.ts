import * as XLSX from "xlsx";
import { importReport, type ImportReport } from "./export-job.ts";

export interface ImportColumn {
  header: string;
  key: string;
  required?: boolean;
}

export interface ParsedSheet {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function parseXlsx(bytes: Uint8Array): ParsedSheet {
  const book = XLSX.read(bytes, { type: "array" });
  const name = book.SheetNames[0];
  if (!name) return { headers: [], rows: [] };
  const sheet = book.Sheets[name];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false, defval: "" });
  const headers = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim());
  const rows = matrix.slice(1).filter((line) => line.some((cell) => String(cell ?? "").trim() !== "")).map((line) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) row[header] = String(line[index] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

export function mapImport(sheet: ParsedSheet, columns: ImportColumn[]): { rows: Array<Record<string, string>>; report: ImportReport } {
  const results = sheet.rows.map((row) => {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const column of columns) {
      const value = row[column.header] ?? "";
      if (column.required && !value) errors.push(`${column.header} is required`);
      mapped[column.key] = value;
    }
    return { ok: errors.length === 0, errors, mapped };
  });
  return {
    rows: results.filter((result) => result.ok).map((result) => result.mapped),
    report: importReport(results.map((result) => ({ ok: result.ok, errors: result.errors }))),
  };
}
