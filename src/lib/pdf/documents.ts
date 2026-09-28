import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { fillAcroForm, inspectAcroForm, type AcroFieldInfo } from "./acroform.ts";

async function ensureTenant(db: Queryable, tenantId: string) {
  await db.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, tenantId]);
}

export interface TemplateRegistration {
  templateId: string;
  version: number;
  sha256: string;
  pageCount: number;
  fields: AcroFieldInfo[];
}

export async function registerPdfTemplate(
  db: Queryable,
  tenantId: string,
  input: { name: string; formId?: string; bytes: Uint8Array; mappings: { pdfField: string; formKey: string; fieldType: string }[] },
): Promise<TemplateRegistration> {
  await ensureTenant(db, tenantId);
  const inspected = await inspectAcroForm(input.bytes);
  const templateId = `pdt_${randomBytes(8).toString("hex")}`;
  await db.query(
    "insert into pdf_templates (id, tenant_id, form_id, name) values ($1,$2,$3,$4)",
    [templateId, tenantId, input.formId ?? null, input.name],
  );
  await db.query(
    `insert into pdf_template_versions (tenant_id, template_id, version, sha256, page_count, byte_length)
     values ($1,$2,1,$3,$4,$5)`,
    [tenantId, templateId, inspected.sha256, inspected.pageCount, input.bytes.byteLength],
  );
  const known = new Set(inspected.fields.map((field) => field.name));
  for (const mapping of input.mappings) {
    if (!known.has(mapping.pdfField)) continue;
    const field = inspected.fields.find((item) => item.name === mapping.pdfField);
    await db.query(
      `insert into pdf_field_mappings (tenant_id, template_id, template_version, pdf_field, form_key, field_type, page, x, y, w, h)
       values ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tenantId, templateId, mapping.pdfField, mapping.formKey, mapping.fieldType, field?.page ?? null, field?.x ?? null, field?.y ?? null, field?.w ?? null, field?.h ?? null],
    );
  }
  return { templateId, version: 1, sha256: inspected.sha256, pageCount: inspected.pageCount, fields: inspected.fields };
}

export interface GeneratedPdf {
  id: string;
  bytes: Uint8Array;
  sha256: string;
  filled: string[];
  missing: string[];
}

export async function generateMappedPdf(
  db: Queryable,
  tenantId: string,
  input: {
    templateId: string;
    version: number;
    sourceBytes: Uint8Array;
    data: Record<string, string | boolean | number | null>;
    submissionId: string;
    formVersion: number;
    submissionRevision: number;
    flatten?: boolean;
  },
): Promise<GeneratedPdf> {
  const versions = await db.query<{ sha256: string }>(
    "select sha256 from pdf_template_versions where tenant_id = $1 and template_id = $2 and version = $3",
    [tenantId, input.templateId, input.version],
  );
  const stored = versions[0];
  if (!stored) throw new Error("PDF template version was not found for this tenant");
  const inspected = await inspectAcroForm(input.sourceBytes);
  if (inspected.sha256 !== stored.sha256) throw new Error("Source PDF hash does not match the stored template version");
  const mappings = await db.query<{ pdf_field: string; form_key: string }>(
    "select pdf_field, form_key from pdf_field_mappings where tenant_id = $1 and template_id = $2 and template_version = $3",
    [tenantId, input.templateId, input.version],
  );
  const values: Record<string, string | boolean> = {};
  for (const mapping of mappings) {
    const raw = input.data[mapping.form_key];
    if (typeof raw === "string" || typeof raw === "boolean") values[mapping.pdf_field] = raw;
    else if (typeof raw === "number") values[mapping.pdf_field] = String(raw);
  }
  const filled = await fillAcroForm(input.sourceBytes, values, { flatten: input.flatten === true });
  const id = `gdoc_${randomBytes(8).toString("hex")}`;
  await db.query(
    `insert into generated_documents (id, tenant_id, submission_id, form_version, submission_revision, template_version, source_template_hash, generated_pdf_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, tenantId, input.submissionId, input.formVersion, input.submissionRevision, input.version, stored.sha256, filled.sha256],
  );
  return { id, bytes: filled.bytes, sha256: filled.sha256, filled: filled.filled, missing: filled.missing };
}
