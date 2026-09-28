import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatValue } from "./pdf.ts";
import { flattenInputs } from "./tree.ts";
import type { FormComponent, PdfAlign, PdfPlacement } from "./types.ts";

export const PDF_PAGE = { width: 612, height: 792 };

export function clampPercent(value: number, min = 2, max = 96): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Form.io overlay units are CSS pixels on a letter page. Percents are 0–100. */
export function parseOverlayLength(value: unknown, span: number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value <= 100) return value;
    return (value / span) * 100;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("%")) {
    const n = Number(trimmed.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const px = trimmed.endsWith("px") ? Number(trimmed.slice(0, -2)) : Number(trimmed);
  if (!Number.isFinite(px)) return null;
  if (trimmed.endsWith("px") || px > 100) return (px / span) * 100;
  return px;
}

export function overlayToPlacement(overlay: Record<string, unknown>, previous?: PdfPlacement): PdfPlacement | null {
  const page = Number(overlay.page ?? previous?.page ?? 1);
  const x = parseOverlayLength(overlay.left, PDF_PAGE.width);
  const y = parseOverlayLength(overlay.top, PDF_PAGE.height);
  const w = parseOverlayLength(overlay.width, PDF_PAGE.width);
  const h = parseOverlayLength(overlay.height, PDF_PAGE.height);
  if (![page, x, y, w, h].every((item) => item != null && Number.isFinite(item))) return null;
  return {
    ...previous,
    page: Math.max(1, Math.floor(page)),
    x: x as number,
    y: y as number,
    w: w as number,
    h: h as number,
  };
}

export function placementToOverlay(pdf: PdfPlacement): { page: number; left: string; top: string; width: string; height: string } {
  return {
    page: pdf.page,
    left: `${round((pdf.x / 100) * PDF_PAGE.width)}px`,
    top: `${round((pdf.y / 100) * PDF_PAGE.height)}px`,
    width: `${round((pdf.w / 100) * PDF_PAGE.width)}px`,
    height: `${round((pdf.h / 100) * PDF_PAGE.height)}px`,
  };
}

export function withPdfPlacement(component: FormComponent, pdf: PdfPlacement | undefined): Pick<FormComponent, "pdf" | "formio"> {
  const formio = { ...(component.formio ?? {}) };
  if (!pdf) {
    delete formio.overlay;
    return { pdf: undefined, formio };
  }
  formio.overlay = placementToOverlay(pdf);
  return { pdf, formio };
}

export function defaultPlacement(index: number, page = 1): PdfPlacement {
  const row = index % 10;
  const column = Math.floor(index / 10) % 2;
  return {
    page,
    x: 8 + column * 46,
    y: 8 + row * 8,
    w: 40,
    h: 5.5,
    fontSize: 11,
    align: "left",
    font: "Helvetica",
    showLabel: true,
  };
}

export function sampleSubmission(components: FormComponent[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const component of flattenInputs(components)) {
    if (component.defaultValue !== undefined && component.defaultValue !== null && component.defaultValue !== "") {
      data[component.key] = component.defaultValue;
      continue;
    }
    switch (component.type) {
      case "checkbox":
      case "toggle":
        data[component.key] = true;
        break;
      case "select":
      case "radio":
        data[component.key] = component.values?.[0]?.value ?? "a";
        break;
      case "selectboxes":
        data[component.key] = (component.values ?? []).slice(0, 2).map((item) => item.value);
        break;
      case "number":
      case "currency":
      case "slider":
      case "rating":
        data[component.key] = component.defaultValue ?? component.min ?? 1;
        break;
      case "date":
        data[component.key] = "2026-09-28";
        break;
      case "datetime":
        data[component.key] = "2026-09-28T15:00";
        break;
      case "time":
        data[component.key] = "15:04";
        break;
      case "email":
        data[component.key] = "ada@example.com";
        break;
      case "phone":
        data[component.key] = "+1 202 555 0147";
        break;
      case "url":
        data[component.key] = "https://example.com";
        break;
      case "address":
        data[component.key] = { line1: "1 Market Street", city: "San Francisco", region: "CA", postalCode: "94105", country: "US" };
        break;
      case "file":
        data[component.key] = { name: "attachment.pdf", size: 1200, type: "application/pdf", sha256: "abc123" };
        break;
      case "signature":
        data[component.key] = "Ada Lovelace";
        break;
      case "captcha":
        data[component.key] = { passed: true };
        break;
      default:
        data[component.key] = component.placeholder || component.label || component.key;
    }
  }
  return data;
}

function optionLabel(component: FormComponent, value: string): string {
  return component.values?.find((item) => item.value === value)?.label ?? value;
}

export function formatPdfValue(component: FormComponent, value: unknown): string {
  if (value == null || value === "") return "";
  if (component.type === "captcha") return "Verified";
  if (component.type === "checkbox" || component.type === "toggle") return value === true ? "Yes" : "No";
  if (component.type === "select" || component.type === "radio") return optionLabel(component, String(value));
  if (component.type === "selectboxes" && Array.isArray(value)) return value.map((item) => optionLabel(component, String(item))).join(", ");
  const format = component.pdf?.format ?? "";
  if ((component.type === "currency" || format === "currency") && (typeof value === "number" || typeof value === "string")) {
    const amount = Number(value);
    if (Number.isFinite(amount)) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: component.currency || "USD" }).format(amount);
    }
  }
  if ((component.type === "date" || component.type === "datetime") && format.includes("YYYY")) {
    const iso = String(value).slice(0, 10);
    const [year, month, day] = iso.split("-");
    if (year && month && day) return format.replace("YYYY", year).replace("MM", month).replace("DD", day);
  }
  const text = formatValue(value);
  if (format === "upper") return text.toUpperCase();
  if (format === "lower") return text.toLowerCase();
  return text;
}

export function safePdfText(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 63;
    if (code === 10 || code === 13 || code === 9) {
      out += " ";
      continue;
    }
    out += (code >= 32 && code <= 126) || (code >= 160 && code <= 255) ? ch : "?";
  }
  return out;
}

function boxOf(pdf: PdfPlacement, pageWidth: number, pageHeight: number) {
  const width = (pdf.w / 100) * pageWidth;
  const height = (pdf.h / 100) * pageHeight;
  const x = (pdf.x / 100) * pageWidth;
  const y = pageHeight - ((pdf.y / 100) * pageHeight + height);
  return { x, y, width: Math.max(8, width), height: Math.max(8, height) };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawAligned(page: PDFPage, text: string, font: PDFFont, size: number, box: { x: number; y: number; width: number; height: number }, align: PdfAlign, y: number) {
  const safe = safePdfText(text);
  const width = font.widthOfTextAtSize(safe, size);
  let x = box.x + 3;
  if (align === "center") x = box.x + Math.max(2, (box.width - width) / 2);
  if (align === "right") x = box.x + Math.max(2, box.width - width - 3);
  page.drawText(safe, { x, y, size, font, color: rgb(0.08, 0.09, 0.12) });
}

function drawField(page: PDFPage, component: FormComponent, font: PDFFont, bold: PDFFont, oblique: PDFFont, courier: PDFFont, value: string, mode: "blank" | "filled") {
  const placement = component.pdf;
  if (!placement) return;
  const size = page.getSize();
  const box = boxOf(placement, size.width, size.height);
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    borderWidth: 0.6,
    borderColor: rgb(0.25, 0.28, 0.33),
  });
  const align = placement.align ?? "left";
  const fontSize = Math.max(7, Math.min(placement.fontSize ?? 11, box.height - 2));
  const chosen = placement.font === "Helvetica-Bold" ? bold : placement.font === "Courier" ? courier : placement.font === "Helvetica-Oblique" || component.type === "signature" ? oblique : font;
  if (component.type === "checkbox" || component.type === "toggle") {
    const mark = mode === "filled" && value === "Yes";
    if (mark) {
      page.drawLine({ start: { x: box.x + 2, y: box.y + 2 }, end: { x: box.x + box.width - 2, y: box.y + box.height - 2 }, thickness: 1.2, color: rgb(0.08, 0.09, 0.12) });
      page.drawLine({ start: { x: box.x + 2, y: box.y + box.height - 2 }, end: { x: box.x + box.width - 2, y: box.y + 2 }, thickness: 1.2, color: rgb(0.08, 0.09, 0.12) });
    }
    return;
  }
  const label = placement.showLabel === false ? "" : component.label;
  const body = mode === "blank" ? label : value || (placement.showLabel === false ? "" : label);
  const lines = wrapText(body || " ", chosen, fontSize, Math.max(8, box.width - 6));
  let cursor = box.y + box.height - fontSize - 2;
  for (const line of lines) {
    if (cursor < box.y + 1) break;
    drawAligned(page, line, chosen, fontSize, box, align, cursor);
    cursor -= fontSize + 2;
  }
}

function drawRecord(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, rows: { label: string; value: string }[], startAt = 0): number {
  const { width, height } = page.getSize();
  let y = height - 48;
  page.drawText(safePdfText(title), { x: 48, y, size: 16, font: bold, color: rgb(0.08, 0.09, 0.12) });
  y -= 18;
  page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 0.6, color: rgb(0.2, 0.24, 0.3) });
  y -= 18;
  let index = startAt;
  for (; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (y < 56) return index;
    page.drawText(safePdfText(row.label).slice(0, 80), { x: 48, y, size: 8, font, color: rgb(0.35, 0.38, 0.42) });
    y -= 12;
    for (const line of wrapText(row.value || "—", font, 11, width - 96).slice(0, 4)) {
      if (y < 48) return index;
      page.drawText(safePdfText(line), { x: 48, y, size: 11, font: bold, color: rgb(0.08, 0.09, 0.12) });
      y -= 14;
    }
    y -= 6;
  }
  return index;
}

export async function renderFormPdf(input: {
  title: string;
  pageCount: number;
  components: FormComponent[];
  data: Record<string, unknown>;
  background?: Uint8Array | null;
  mode: "blank" | "filled";
  appendRecord?: boolean;
}): Promise<Uint8Array> {
  const wanted = Math.max(1, input.pageCount);
  const doc = input.background?.byteLength
    ? await PDFDocument.load(input.background, { ignoreEncryption: true })
    : await PDFDocument.create();
  while (doc.getPageCount() < wanted) doc.addPage([PDF_PAGE.width, PDF_PAGE.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const fields = flattenInputs(input.components).filter((component) => component.pdf && component.type !== "content" && component.type !== "button" && component.type !== "review");
  for (const component of fields) {
    const page = doc.getPage((component.pdf?.page ?? 1) - 1);
    if (!page) continue;
    const value = input.mode === "filled" ? formatPdfValue(component, input.data[component.key]) : "";
    drawField(page, component, font, bold, oblique, courier, value, input.mode);
  }
  if (fields.length === 0 && !input.background?.byteLength) {
    const page = doc.getPage(0);
    page.drawText(safePdfText(input.title || "Form"), { x: 48, y: page.getSize().height - 64, size: 18, font: bold, color: rgb(0.08, 0.09, 0.12) });
    page.drawText("No fields are placed on the page yet.", { x: 48, y: page.getSize().height - 88, size: 11, font, color: rgb(0.25, 0.28, 0.33) });
  }
  if (input.mode === "filled" && input.appendRecord !== false) {
    const rows = flattenInputs(input.components)
      .filter((component) => component.type !== "content" && component.type !== "button" && component.type !== "review" && component.type !== "captcha")
      .map((component) => ({ label: component.label || component.key, value: formatPdfValue(component, input.data[component.key]) || "—" }));
    let cursor = 0;
    let guard = 0;
    while (cursor < rows.length && guard < 12) {
      const page = doc.addPage([PDF_PAGE.width, PDF_PAGE.height]);
      cursor = drawRecord(page, font, bold, cursor === 0 ? input.title : `${input.title} (continued)`, rows, cursor);
      guard += 1;
    }
  }
  return doc.save();
}

export function exportOverlays(components: FormComponent[]): { key: string; label: string; overlay: ReturnType<typeof placementToOverlay> }[] {
  return flattenInputs(components)
    .filter((component) => component.pdf)
    .map((component) => ({ key: component.key, label: component.label, overlay: placementToOverlay(component.pdf!) }));
}

export function importOverlayList(raw: unknown): { key: string; pdf: PdfPlacement }[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { components?: unknown }).components) ? (raw as { components: unknown[] }).components : [];
  const placed: { key: string; pdf: PdfPlacement }[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as { key?: unknown; overlay?: unknown };
    const key = typeof record.key === "string" ? record.key : "";
    if (!key || !record.overlay || typeof record.overlay !== "object") continue;
    const pdf = overlayToPlacement(record.overlay as Record<string, unknown>);
    if (pdf) placed.push({ key, pdf });
  }
  return placed;
}
