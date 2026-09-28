import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Placement } from "./editor-model.ts";
import { planDocument, sha256Hex, type GeneratedDocument } from "./generated-docs.ts";

export interface PageSize {
  width: number;
  height: number;
}

export const LETTER: PageSize = { width: 612, height: 792 };

export interface DrawItem {
  placement: Placement;
  text: string;
}

/** Top-left normalized box to PDF user space (origin bottom-left). */
export function boxToPdf(placement: Placement, page: PageSize): { x: number; y: number; width: number; height: number } {
  const width = placement.w * page.width;
  const height = placement.h * page.height;
  const x = placement.x * page.width;
  const y = page.height - (placement.y * page.height + height);
  return { x, y, width, height };
}

function fontSize(placement: Placement, boxHeight: number): number {
  return Math.max(6, Math.min(placement.fontSize || 11, boxHeight - 2));
}

/**
 * Draw manual placements onto a new PDF.
 * Signature, initials, image, and stamp fields are labeled boxes. They are not biometric signatures.
 */
export async function renderPlacements(input: {
  pageCount: number;
  pageSize?: PageSize;
  items: DrawItem[];
}): Promise<Uint8Array> {
  const size = input.pageSize ?? LETTER;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = [];
  for (let index = 0; index < Math.max(1, input.pageCount); index += 1) pages.push(doc.addPage([size.width, size.height]));
  for (const item of input.items) {
    const page = pages[item.placement.page - 1];
    if (!page) continue;
    const box = boxToPdf(item.placement, size);
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      borderWidth: 0.4,
      borderColor: rgb(0.2, 0.2, 0.2),
    });
    const sizePt = fontSize(item.placement, box.height);
    const label = item.placement.pdfFieldType === "checkbox"
      ? (item.text === "true" || item.text === "yes" ? "Yes" : "No")
      : item.text;
    if (!label) continue;
    page.drawText(label.slice(0, 200), {
      x: box.x + 2,
      y: box.y + Math.max(2, (box.height - sizePt) / 2),
      size: sizePt,
      font,
      color: rgb(0.07, 0.08, 0.09),
      maxWidth: Math.max(8, box.width - 4),
    });
  }
  return doc.save();
}

export async function generatePlacedDocument(input: {
  tenantId: string;
  submissionId: string;
  formVersionId: number;
  templateVersion: number;
  createdBy: string;
  data: Record<string, unknown>;
  placements: Placement[];
  pageCount: number;
}): Promise<{ bytes: Uint8Array; document: GeneratedDocument }> {
  const items = input.placements.map((placement) => ({
    placement,
    text: input.data[placement.componentKey] == null ? "" : String(input.data[placement.componentKey]),
  }));
  const bytes = await renderPlacements({ pageCount: input.pageCount, items });
  const document = planDocument({
    tenantId: input.tenantId,
    submissionId: input.submissionId,
    formVersionId: input.formVersionId,
    pdfTemplateVersionId: input.templateVersion,
    pdfBytes: bytes,
    createdBy: input.createdBy,
    storageProvider: "memory",
    status: "generated",
  });
  if (document.generatedHash !== sha256Hex(bytes)) throw new Error("Generated hash did not match the bytes");
  return { bytes, document };
}
