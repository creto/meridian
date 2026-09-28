const MIME: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
};

const TEXT_OK = new Set(["text/csv", "application/json", "text/plain"]);

export interface UploadCheck {
  filename: string;
  declaredType: string;
  bytes: Uint8Array;
}

export type UploadVerdict = { ok: true; type: string } | { ok: false; code: "MIME" | "NAME" | "EMPTY" | "SCRIPT" };

export function sniffType(bytes: Uint8Array): string | null {
  for (const [type, signatures] of Object.entries(MIME)) {
    if (signatures.some((sig) => sig.every((byte, index) => bytes[index] === byte))) return type;
  }
  return null;
}

export function checkUpload(upload: UploadCheck, allowed: string[]): UploadVerdict {
  if (!upload.bytes.length) return { ok: false, code: "EMPTY" };
  const name = upload.filename.trim();
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\") || name.includes("\0")) return { ok: false, code: "NAME" };
  if (name.toLowerCase().endsWith(".html") || name.toLowerCase().endsWith(".svg") || name.toLowerCase().endsWith(".exe")) {
    return { ok: false, code: "SCRIPT" };
  }
  const declared = upload.declaredType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!allowed.includes(declared)) return { ok: false, code: "MIME" };
  if (TEXT_OK.has(declared)) {
    const head = Buffer.from(upload.bytes.subarray(0, 64)).toString("utf8").trimStart().toLowerCase();
    if (head.startsWith("<script") || head.startsWith("<html") || head.startsWith("<?php")) return { ok: false, code: "SCRIPT" };
    return { ok: true, type: declared };
  }
  const sniffed = sniffType(upload.bytes);
  if (!sniffed || sniffed !== declared) return { ok: false, code: "MIME" };
  return { ok: true, type: sniffed };
}
