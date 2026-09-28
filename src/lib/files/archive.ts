import { createHash, randomUUID } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

export type FileStatus = "UPLOADING" | "READY" | "QUARANTINED" | "FAILED" | "DELETED";

export const FILE_STATUSES: readonly FileStatus[] = ["UPLOADING", "READY", "QUARANTINED", "FAILED", "DELETED"];

export interface FileRecord {
  id: string;
  tenant_id: string;
  workspace_id: string;
  submission_id: string | null;
  field_key: string | null;
  filename: string;
  sanitized_filename: string;
  mime: string;
  size: number;
  sha256: string;
  provider: string;
  object_key: string;
  status: FileStatus;
  created_by: string;
  created_at: string | Date;
}

export interface RecordUploadInput {
  workspaceId: string;
  submissionId?: string | null;
  fieldKey?: string | null;
  filename: string;
  declaredMime: string;
  bytes: Uint8Array;
  provider: string;
  objectKey: string;
  createdBy: string;
}

export function sanitizeFilename(name: string): string {
  const base = String(name ?? "").split(/[/\\]/).filter((part) => part.length > 0).pop() ?? "";
  const withoutControls = base.replace(/[\u0000-\u001f\u007f]/g, "");
  const collapsed = withoutControls.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const limited = collapsed.slice(0, 120).replace(/_+$/g, "");
  return limited || "file";
}

function declaredBase(declared: string): string {
  return declared.split(";")[0]?.trim().toLowerCase() ?? "";
}

function sniffMagic(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  return null;
}

function declaresPdf(declared: string): boolean {
  const base = declaredBase(declared);
  return base === "pdf" || base === "application/pdf" || base === "application/x-pdf" || base.endsWith("/pdf");
}

function matchesSniff(sniffed: string, declared: string): boolean {
  const base = declaredBase(declared);
  if (sniffed === base) return true;
  if (sniffed === "application/pdf" && declaresPdf(declared)) return true;
  if (sniffed === "image/jpeg" && (base === "image/jpg" || base === "image/pjpeg" || base === "image/jpeg")) return true;
  if (sniffed === "image/png" && (base === "image/png" || base === "image/x-png")) return true;
  if (sniffed === "image/gif" && base === "image/gif") return true;
  return false;
}

export function sniffMime(bytes: Uint8Array, declared: string): { mime: string; mismatch: boolean } {
  const sniffed = sniffMagic(bytes);
  if (!sniffed) {
    if (declaresPdf(declared) || ["image/png", "image/jpeg", "image/jpg", "image/pjpeg", "image/gif", "image/x-png"].includes(declaredBase(declared))) {
      return { mime: "application/octet-stream", mismatch: true };
    }
    return { mime: declaredBase(declared) || "application/octet-stream", mismatch: false };
  }
  return { mime: sniffed, mismatch: !matchesSniff(sniffed, declared) };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function recordUpload(db: Queryable, tenantId: string, input: RecordUploadInput): Promise<{ id: string; status: FileStatus }> {
  const sniffed = sniffMime(input.bytes, input.declaredMime);
  const status: FileStatus = sniffed.mismatch ? "QUARANTINED" : "READY";
  const filename = input.filename.replace(/\u0000/g, "");
  const id = `file_${randomUUID()}`;
  const hash = sha256(input.bytes);
  const size = input.bytes.byteLength;
  await db.query(
    `insert into files (
       id, tenant_id, workspace_id, submission_id, field_key, filename, sanitized_filename,
       mime, size, sha256, provider, object_key, status, created_by
     ) values (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13, $14
     )`,
    [
      id,
      tenantId,
      input.workspaceId,
      input.submissionId ?? null,
      input.fieldKey ?? null,
      filename,
      sanitizeFilename(filename),
      sniffed.mime,
      size,
      hash,
      input.provider,
      input.objectKey,
      status,
      input.createdBy,
    ],
  );
  await db.query(
    `insert into file_versions (tenant_id, file_id, version, sha256, size)
     values ($1, $2, 1, $3, $4)`,
    [tenantId, id, hash, size],
  );
  return { id, status };
}

export async function listFiles(db: Queryable, tenantId: string, submissionId: string): Promise<FileRecord[]> {
  return db.query<FileRecord>(
    `select id, tenant_id, workspace_id, submission_id, field_key, filename, sanitized_filename,
            mime, size, sha256, provider, object_key, status, created_by, created_at
       from files
      where tenant_id = $1 and submission_id = $2
      order by created_at asc, id asc`,
    [tenantId, submissionId],
  );
}
