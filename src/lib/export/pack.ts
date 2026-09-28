export interface ExportSubmission {
  id: string;
  formId: string;
  status: string;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function submissionsToJson(rows: ExportSubmission[]): string {
  return JSON.stringify(rows);
}

export function submissionsToNdjson(rows: ExportSubmission[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

export function submissionsToCsv(rows: ExportSubmission[], fields: string[]): string {
  const header = ["id", "formId", "status", "createdAt", ...fields].map(csvCell).join(",");
  const lines = rows.map((row) => ["id", "formId", "status", "createdAt", ...fields].map((field) => {
    if (field === "id" || field === "formId" || field === "status" || field === "createdAt") return csvCell(row[field as keyof ExportSubmission]);
    return csvCell(row.data[field]);
  }).join(","));
  return [header, ...lines].join("\n");
}

function safeZipName(name: string): string {
  if (!name || name.length > 180) throw new Error("ZIP entry name is missing or too long");
  if (name.includes("\\") || name.includes("\0") || name.startsWith("/") || name.split("/").includes("..")) {
    throw new Error(`ZIP entry name is not safe: ${name}`);
  }
  return name;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/** Uncompressed ZIP (method 0). Enough for a submission bundle of JSON plus attachments. */
export function zipStore(entries: ZipEntry[], now = new Date()): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);
  for (const entry of entries) {
    const name = safeZipName(entry.name);
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);
    u32(view, 0, 0x04034b50);
    u16(view, 4, 20);
    u16(view, 8, 0);
    u16(view, 10, dosTime);
    u16(view, 12, dosDate);
    u32(view, 14, crc);
    u32(view, 18, entry.data.length);
    u32(view, 22, entry.data.length);
    u16(view, 26, nameBytes.length);
    local.set(nameBytes, 30);
    locals.push(local, entry.data);
    const dir = new Uint8Array(46 + nameBytes.length);
    const dirView = new DataView(dir.buffer);
    u32(dirView, 0, 0x02014b50);
    u16(dirView, 4, 20);
    u16(dirView, 6, 20);
    u16(dirView, 12, dosTime);
    u16(dirView, 14, dosDate);
    u32(dirView, 16, crc);
    u32(dirView, 20, entry.data.length);
    u32(dirView, 24, entry.data.length);
    u16(dirView, 28, nameBytes.length);
    u32(dirView, 42, offset);
    dir.set(nameBytes, 46);
    central.push(dir);
    offset += local.length + entry.data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, offset);
  const parts = [...locals, ...central, end];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export function readZipNames(bytes: Uint8Array): string[] {
  const names: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;
    const nameLength = view.getUint16(offset + 26, true);
    const extra = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 18, true);
    names.push(new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)));
    offset += 30 + nameLength + extra + size;
  }
  return names;
}
