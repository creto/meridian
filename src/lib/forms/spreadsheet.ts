import { componentsFromFieldTable, componentsFromProfiles, looksLikeFieldTable, profileColumns } from "./importing.ts";
import type { ColumnProfile } from "./importing.ts";
import type { FormComponent } from "./types.ts";

export interface SheetSummary {
  name: string;
  rows: number;
  columns: number;
}

export interface SheetImport {
  sheetName: string;
  sheetCount: number;
  sheets: SheetSummary[];
  profiles: ColumnProfile[];
  components: FormComponent[];
  mode: "field-table" | "data-profile";
  warnings: string[];
}

type Workbook = {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
};

async function loadBook(data: ArrayBuffer): Promise<{ XLSX: typeof import("xlsx"); book: Workbook }> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(data, { type: "array" }) as Workbook;
  return { XLSX, book };
}

function rowsOf(XLSX: typeof import("xlsx"), book: Workbook, sheetName: string): Record<string, string>[] {
  const sheet = book.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false }) : [];
}

function fromRows(sheetName: string, sheetCount: number, sheets: SheetSummary[], rows: Record<string, string>[]): SheetImport {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const warnings: string[] = [];
  if (sheetCount > 1) warnings.push(`${sheetCount} sheets. Only ${sheetName || "the selected sheet"} is imported.`);
  if (rows.length > 500) warnings.push(`Profiling used ${rows.length} rows. Types are inferred, not guaranteed.`);
  if (looksLikeFieldTable(headers)) {
    return {
      sheetName,
      sheetCount,
      sheets,
      profiles: [],
      components: componentsFromFieldTable(rows),
      mode: "field-table",
      warnings,
    };
  }
  const profiles = profileColumns(rows);
  const low = profiles.filter((item) => item.confidence < 0.7).map((item) => item.field);
  if (low.length) warnings.push(`Low confidence on: ${low.slice(0, 6).join(", ")}`);
  return {
    sheetName,
    sheetCount,
    sheets,
    profiles,
    components: componentsFromProfiles(profiles),
    mode: "data-profile",
    warnings,
  };
}

export async function inspectWorkbook(data: ArrayBuffer): Promise<{ sheets: SheetSummary[] }> {
  const { XLSX, book } = await loadBook(data);
  return {
    sheets: book.SheetNames.map((name) => {
      const rows = rowsOf(XLSX, book, name);
      const columns = rows[0] ? Object.keys(rows[0]).length : 0;
      return { name, rows: rows.length, columns };
    }),
  };
}

export async function importWorkbook(data: ArrayBuffer, sheetName?: string): Promise<SheetImport> {
  const { XLSX, book } = await loadBook(data);
  const sheets = book.SheetNames.map((name) => {
    const rows = rowsOf(XLSX, book, name);
    return { name, rows: rows.length, columns: rows[0] ? Object.keys(rows[0]).length : 0 };
  });
  const chosen = sheetName && book.SheetNames.includes(sheetName) ? sheetName : book.SheetNames[0];
  if (!chosen) return { sheetName: "", sheetCount: 0, sheets: [], profiles: [], components: [], mode: "data-profile", warnings: ["Workbook has no sheets."] };
  return fromRows(chosen, book.SheetNames.length, sheets, rowsOf(XLSX, book, chosen));
}
