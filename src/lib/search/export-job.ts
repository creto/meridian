import * as XLSX from "xlsx";

export interface SubmissionFilter {
  tenantId: string;
  formId?: string;
  status?: string;
  text?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface Cursor {
  id: string;
  at: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (!parsed.id || !parsed.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildSubmissionQuery(filter: SubmissionFilter): { text: string; params: unknown[] } {
  const params: unknown[] = [filter.tenantId];
  const where = ["tenant_id = $1"];
  if (filter.formId) {
    params.push(filter.formId);
    where.push(`form_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }
  if (filter.from) {
    params.push(filter.from);
    where.push(`created_at >= $${params.length}`);
  }
  if (filter.to) {
    params.push(filter.to);
    where.push(`created_at < $${params.length}`);
  }
  if (filter.text) {
    params.push(`%${filter.text}%`);
    where.push(`data::text ilike $${params.length}`);
  }
  const cursor = decodeCursor(filter.cursor);
  if (cursor) {
    params.push(cursor.at, cursor.id);
    where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length})`);
  }
  const limit = Math.min(500, Math.max(1, filter.limit ?? 50));
  params.push(limit);
  const text = `select id, form_id, status, created_at, data from submissions where ${where.join(" and ")} order by created_at desc, id desc limit $${params.length}`;
  return { text, params };
}

export interface SavedView {
  id: string;
  name: string;
  resource: "submissions" | "forms" | "jobs";
  filter: SubmissionFilter;
}

export function rowsToXlsx(rows: Array<Record<string, unknown>>): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Export");
  const out = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return out;
}

export function planExportJob(filter: SubmissionFilter, includeAttachments = false): { queue: "export"; payload: { filter: SubmissionFilter; format: "xlsx"; includeAttachments: boolean } } {
  return { queue: "export", payload: { filter, format: "xlsx", includeAttachments } };
}

export interface ImportReport {
  accepted: number;
  rejected: Array<{ row: number; errors: string[] }>;
}

export function importReport(results: Array<{ ok: boolean; errors?: string[] }>): ImportReport {
  const rejected: ImportReport["rejected"] = [];
  let accepted = 0;
  results.forEach((result, index) => {
    if (result.ok) accepted += 1;
    else rejected.push({ row: index + 1, errors: result.errors ?? ["invalid"] });
  });
  return { accepted, rejected };
}
