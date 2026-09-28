import { createHash, randomBytes } from "node:crypto";
import { planDocument, type DocumentStatus, type GeneratedDocument } from "./generated-docs.ts";

export interface StoredDocument extends GeneratedDocument {
  bytes: Uint8Array;
  templateId: string | null;
  audit: Array<{ at: string; action: string; actor: string }>;
}

const registry = new Map<string, StoredDocument[]>();

function key(tenantId: string, submissionId: string): string {
  return `${tenantId}:${submissionId}`;
}

export function resetDocumentRegistry(): void {
  registry.clear();
}

export function rememberDocument(input: {
  tenantId: string;
  submissionId: string;
  formVersionId: number;
  pdfTemplateVersionId?: number | null;
  templateId?: string | null;
  pdfBytes: Uint8Array;
  createdBy: string;
  now?: string;
  status?: DocumentStatus;
}): StoredDocument {
  const planned = planDocument({
    tenantId: input.tenantId,
    submissionId: input.submissionId,
    formVersionId: input.formVersionId,
    pdfTemplateVersionId: input.pdfTemplateVersionId,
    pdfBytes: input.pdfBytes,
    createdBy: input.createdBy,
    storageProvider: "memory",
    status: input.status ?? "stored",
    now: input.now,
  });
  const stored: StoredDocument = {
    ...planned,
    bytes: input.pdfBytes,
    templateId: input.templateId ?? null,
    audit: [{ at: planned.createdAt, action: "generated", actor: input.createdBy }],
  };
  const bucket = registry.get(key(input.tenantId, input.submissionId)) ?? [];
  bucket.push(stored);
  registry.set(key(input.tenantId, input.submissionId), bucket);
  return stored;
}

export function listDocumentHistory(tenantId: string, submissionId: string): Array<Omit<StoredDocument, "bytes">> {
  const bucket = registry.get(key(tenantId, submissionId)) ?? [];
  return bucket.map(({ bytes: _bytes, ...meta }) => meta);
}

export function getDocumentBytes(tenantId: string, documentId: string): StoredDocument | null {
  for (const bucket of registry.values()) {
    const found = bucket.find((item) => item.documentId === documentId && item.tenantId === tenantId);
    if (found) return found;
  }
  return null;
}

/** Regeneration keeps the previous row and writes a new id. */
export function regenerateDocument(tenantId: string, documentId: string, pdfBytes: Uint8Array, actor: string, now?: string): StoredDocument | { ok: false; code: "NOT_FOUND" } {
  const previous = getDocumentBytes(tenantId, documentId);
  if (!previous) return { ok: false, code: "NOT_FOUND" };
  const next = rememberDocument({
    tenantId,
    submissionId: previous.submissionId,
    formVersionId: previous.formVersionId,
    pdfTemplateVersionId: previous.pdfTemplateVersionId,
    templateId: previous.templateId,
    pdfBytes,
    createdBy: actor,
    now,
    status: "stored",
  });
  previous.audit.push({ at: next.createdAt, action: "regenerated", actor });
  return next;
}

export function documentPublicMeta(doc: Omit<StoredDocument, "bytes">) {
  return {
    documentId: doc.documentId,
    tenantId: doc.tenantId,
    submissionId: doc.submissionId,
    formVersionId: doc.formVersionId,
    pdfTemplateVersionId: doc.pdfTemplateVersionId,
    templateId: doc.templateId,
    sourceHash: doc.sourceHash,
    generatedHash: doc.generatedHash,
    status: doc.status,
    storageProvider: doc.storageProvider,
    externalReference: doc.externalReference,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    audit: doc.audit,
    byteLength: undefined as number | undefined,
  };
}

export function shaOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function samplePdf(text: string): Uint8Array {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${text}\n%%EOF`;
  return Buffer.from(`${body}\n${randomBytes(4).toString("hex")}`);
}
