import { createHash, randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

export type DocumentStatus = "generated" | "stored" | "failed";

export interface GeneratedDocument {
  documentId: string;
  tenantId: string;
  submissionId: string;
  formVersionId: number;
  pdfTemplateVersionId: number | null;
  sourceHash: string;
  generatedHash: string;
  status: DocumentStatus;
  storageProvider: string | null;
  externalReference: string | null;
  createdAt: string;
  createdBy: string;
}

export function sha256Hex(bytes: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(typeof bytes === "string" ? bytes : bytes);
  return hash.digest("hex");
}

export function planDocument(input: {
  tenantId: string;
  submissionId: string;
  formVersionId: number;
  pdfTemplateVersionId?: number | null;
  templateBytes?: Uint8Array | null;
  pdfBytes: Uint8Array;
  createdBy: string;
  storageProvider?: string | null;
  externalReference?: string | null;
  status?: DocumentStatus;
  now?: string;
}): GeneratedDocument {
  return {
    documentId: `doc_${randomBytes(8).toString("hex")}`,
    tenantId: input.tenantId,
    submissionId: input.submissionId,
    formVersionId: input.formVersionId,
    pdfTemplateVersionId: input.pdfTemplateVersionId ?? null,
    sourceHash: input.templateBytes ? sha256Hex(input.templateBytes) : sha256Hex(`${input.tenantId}:${input.submissionId}:${input.formVersionId}`),
    generatedHash: sha256Hex(input.pdfBytes),
    status: input.status ?? "stored",
    storageProvider: input.storageProvider ?? null,
    externalReference: input.externalReference ?? null,
    createdAt: input.now ?? new Date().toISOString(),
    createdBy: input.createdBy,
  };
}

export async function insertDocument(db: Queryable, doc: GeneratedDocument): Promise<void> {
  await db.query(
    `insert into generated_documents (
      id, tenant_id, submission_id, form_version, submission_revision, template_version,
      source_template_hash, generated_pdf_hash, generated_at, status, storage_provider,
      external_reference, created_by, pdf_template_id, source_hash, generated_hash
    ) values ($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      doc.documentId,
      doc.tenantId,
      doc.submissionId,
      doc.formVersionId,
      doc.pdfTemplateVersionId,
      doc.sourceHash,
      doc.generatedHash,
      doc.createdAt,
      doc.status,
      doc.storageProvider,
      doc.externalReference,
      doc.createdBy,
      null,
      doc.sourceHash,
      doc.generatedHash,
    ],
  );
}

interface DocumentRow {
  id: string;
  tenant_id: string;
  submission_id: string;
  form_version: number;
  template_version: number | null;
  source_hash: string | null;
  generated_hash: string | null;
  source_template_hash: string | null;
  generated_pdf_hash: string | null;
  status: string | null;
  storage_provider: string | null;
  external_reference: string | null;
  created_by: string | null;
  generated_at: string;
}

function fromRow(row: DocumentRow): GeneratedDocument {
  return {
    documentId: row.id,
    tenantId: row.tenant_id,
    submissionId: row.submission_id,
    formVersionId: Number(row.form_version),
    pdfTemplateVersionId: row.template_version == null ? null : Number(row.template_version),
    sourceHash: row.source_hash ?? row.source_template_hash ?? "",
    generatedHash: row.generated_hash ?? row.generated_pdf_hash ?? "",
    status: row.status === "generated" || row.status === "failed" ? row.status : "stored",
    storageProvider: row.storage_provider,
    externalReference: row.external_reference,
    createdAt: row.generated_at,
    createdBy: row.created_by ?? "system",
  };
}

export async function listDocuments(db: Queryable, tenantId: string, submissionId: string): Promise<GeneratedDocument[]> {
  const rows = await db.query<DocumentRow>(
    `select id, tenant_id, submission_id, form_version, template_version, source_hash, generated_hash,
            source_template_hash, generated_pdf_hash, status, storage_provider, external_reference, created_by, generated_at
     from generated_documents where tenant_id = $1 and submission_id = $2 order by generated_at`,
    [tenantId, submissionId],
  );
  return rows.map(fromRow);
}

export async function getDocument(db: Queryable, tenantId: string, documentId: string): Promise<GeneratedDocument | null> {
  const rows = await db.query<DocumentRow>(
    `select id, tenant_id, submission_id, form_version, template_version, source_hash, generated_hash,
            source_template_hash, generated_pdf_hash, status, storage_provider, external_reference, created_by, generated_at
     from generated_documents where tenant_id = $1 and id = $2`,
    [tenantId, documentId],
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

/** A regeneration is a new row. The previous document stays addressable. */
export async function regenerateDocument(
  db: Queryable,
  previous: GeneratedDocument,
  pdfBytes: Uint8Array,
  actor: string,
): Promise<GeneratedDocument> {
  const next = planDocument({
    tenantId: previous.tenantId,
    submissionId: previous.submissionId,
    formVersionId: previous.formVersionId,
    pdfTemplateVersionId: previous.pdfTemplateVersionId,
    pdfBytes,
    createdBy: actor,
    storageProvider: previous.storageProvider,
    status: "stored",
  });
  await insertDocument(db, next);
  return next;
}
