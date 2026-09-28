import type { Queryable } from "../platform/durable.ts";
import { PDF_FIELD_TYPES, type PdfFieldType, type Placement } from "./editor-model.ts";

export interface OverlayRow {
  id: string;
  tenantId: string;
  templateId: string;
  templateVersion: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  componentKey: string;
  pdfFieldType: PdfFieldType;
  font: string;
  fontSize: number;
  alignment: string;
  format: string | null;
  required: boolean;
}

export function placementToRow(placement: Placement, tenantId: string, templateId: string, templateVersion: number): OverlayRow {
  if (!PDF_FIELD_TYPES.includes(placement.pdfFieldType)) throw new Error("Unknown PDF field type");
  if (placement.page < 1) throw new Error("Page must be 1-based");
  for (const value of [placement.x, placement.y, placement.w, placement.h]) {
    if (value < 0 || value > 1) throw new Error("Coordinates must be page-normalized between 0 and 1");
  }
  if (!placement.componentKey.trim()) throw new Error("componentKey is required");
  return {
    id: placement.id,
    tenantId,
    templateId,
    templateVersion,
    page: placement.page,
    x: placement.x,
    y: placement.y,
    w: placement.w,
    h: placement.h,
    rotation: placement.rotation,
    componentKey: placement.componentKey,
    pdfFieldType: placement.pdfFieldType,
    font: placement.font,
    fontSize: placement.fontSize,
    alignment: placement.align,
    format: placement.format || null,
    required: placement.required,
  };
}

export function rowToPlacement(row: OverlayRow): Placement {
  return {
    id: row.id,
    page: row.page,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    rotation: row.rotation,
    componentKey: row.componentKey,
    pdfFieldType: row.pdfFieldType,
    font: row.font,
    fontSize: row.fontSize,
    align: row.alignment === "center" || row.alignment === "right" ? row.alignment : "left",
    format: row.format ?? "",
    required: row.required,
  };
}

/** Replace every overlay for one template version. Older versions are left in place. */
export async function replaceOverlays(db: Queryable, tenantId: string, templateId: string, templateVersion: number, placements: Placement[]): Promise<number> {
  const rows = placements.map((placement) => placementToRow(placement, tenantId, templateId, templateVersion));
  await db.query(
    "delete from pdf_overlays where tenant_id = $1 and template_id = $2 and template_version = $3",
    [tenantId, templateId, templateVersion],
  );
  for (const row of rows) {
    await db.query(
      `insert into pdf_overlays (
        id, tenant_id, template_id, template_version, page, x, y, w, h, rotation, component_key, pdf_field_type, font, font_size, alignment, format, required
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [row.id, row.tenantId, row.templateId, row.templateVersion, row.page, row.x, row.y, row.w, row.h, row.rotation, row.componentKey, row.pdfFieldType, row.font, row.fontSize, row.alignment, row.format, row.required],
    );
  }
  return rows.length;
}

export async function loadOverlays(db: Queryable, tenantId: string, templateId: string, templateVersion: number): Promise<Placement[]> {
  const rows = await db.query<Record<string, unknown>>(
    `select id, tenant_id, template_id, template_version, page, x, y, w, h, rotation, component_key, pdf_field_type, font, font_size, alignment, format, required
     from pdf_overlays where tenant_id = $1 and template_id = $2 and template_version = $3 order by page, id`,
    [tenantId, templateId, templateVersion],
  );
  return rows.map((row) => rowToPlacement({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    templateId: String(row.template_id),
    templateVersion: Number(row.template_version),
    page: Number(row.page),
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.w),
    h: Number(row.h),
    rotation: Number(row.rotation),
    componentKey: String(row.component_key),
    pdfFieldType: String(row.pdf_field_type) as PdfFieldType,
    font: String(row.font),
    fontSize: Number(row.font_size),
    alignment: String(row.alignment),
    format: row.format == null ? null : String(row.format),
    required: Boolean(row.required),
  }));
}
