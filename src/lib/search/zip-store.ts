import { createHash } from "node:crypto";

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date: Date): { time: number; day: number } {
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

/**
 * Stored-method ZIP (no compression). Used for export bundles of the workbook plus attachment bytes.
 * Names reject path traversal and backslashes.
 */
export function buildStoredZip(entries: ZipEntry[], now = new Date("2026-01-01T00:00:00Z")): Uint8Array {
  const stamp = dosTime(now);
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    if (!entry.name || entry.name.includes("..") || entry.name.includes("\\") || entry.name.startsWith("/")) {
      throw new Error(`Unsafe zip name ${entry.name}`);
    }
    const name = Buffer.from(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20);
    u16(lv, 6, 0);
    u16(lv, 8, 0);
    u16(lv, 10, stamp.time);
    u16(lv, 12, stamp.day);
    u32(lv, 14, crc);
    u32(lv, 18, entry.bytes.length);
    u32(lv, 22, entry.bytes.length);
    u16(lv, 26, name.length);
    u16(lv, 28, 0);
    local.set(name, 30);
    locals.push(local, entry.bytes);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20);
    u16(cv, 6, 20);
    u16(cv, 8, 0);
    u16(cv, 10, 0);
    u16(cv, 12, stamp.time);
    u16(cv, 14, stamp.day);
    u32(cv, 16, crc);
    u32(cv, 20, entry.bytes.length);
    u32(cv, 24, entry.bytes.length);
    u16(cv, 28, name.length);
    u16(cv, 30, 0);
    u16(cv, 32, 0);
    u16(cv, 34, 0);
    u16(cv, 36, 0);
    u32(cv, 38, 0);
    u32(cv, 42, offset);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + entry.bytes.length;
  }
  const centralBytes = concat(central);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 4, 0);
  u16(ev, 6, 0);
  u16(ev, 8, entries.length);
  u16(ev, 10, entries.length);
  u32(ev, 12, centralBytes.length);
  u32(ev, 16, offset);
  u16(ev, 20, 0);
  return concat([...locals, centralBytes, end]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export function zipSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface AttachmentRef {
  name: string;
  bytes: Uint8Array;
}

/** Bundle an xlsx workbook with optional attachment files. The workbook is always entry 0. */
export function bundleExport(xlsx: Uint8Array, attachments: AttachmentRef[]): { bytes: Uint8Array; names: string[]; sha256: string } {
  const entries: ZipEntry[] = [{ name: "export.xlsx", bytes: xlsx }, ...attachments.map((file) => ({ name: `attachments/${file.name}`, bytes: file.bytes }))];
  const bytes = buildStoredZip(entries);
  return { bytes, names: entries.map((entry) => entry.name), sha256: zipSha256(bytes) };
}
