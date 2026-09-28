import { createHash } from "node:crypto";
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFOptionList,
  PDFPage,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
  PDFTextField,
  PDFWidgetAnnotation,
  PageSizes,
  StandardFonts,
  rgb,
} from "pdf-lib";

export interface AcroFieldInfo {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "option-list" | "signature" | "unknown";
  options: string[];
  /** 0-based page index. Null when the field has no widget on a page. */
  page: number | null;
  // normalized 0..1 relative to the page crop box, origin top-left for the editor
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

interface NormalizedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NULL_PLACEMENT = {
  page: null,
  x: null,
  y: null,
  w: null,
  h: null,
} as const;

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function loadPdf(bytes: Uint8Array, purpose: "inspection" | "fill"): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const action = purpose === "inspection" ? "AcroForm inspection" : "AcroForm fill";
    throw new Error(`Failed to load PDF for ${action}: ${detail}`);
  }
}

function fieldType(field: PDFField): AcroFieldInfo["type"] {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "option-list";
  if (field instanceof PDFSignature) return "signature";
  return "unknown";
}

function readOptions(field: PDFField): string[] {
  if (field instanceof PDFRadioGroup || field instanceof PDFDropdown || field instanceof PDFOptionList) {
    return field.getOptions().slice();
  }
  return [];
}

function annotsContain(page: PDFPage, ref: PDFRef): boolean {
  const annots = page.node.Annots();
  if (!annots) return false;
  return annots.indexOf(ref) !== undefined;
}

function pageIndexForWidget(doc: PDFDocument, field: PDFField, widget: PDFWidgetAnnotation): number | null {
  const pages = doc.getPages();
  const pointed = widget.P();
  if (pointed) {
    const pointedIndex = pages.findIndex((page) => page.ref === pointed);
    if (pointedIndex >= 0) return pointedIndex;
  }

  const refs: PDFRef[] = [];
  const widgetRef = doc.context.getObjectRef(widget.dict);
  if (widgetRef) refs.push(widgetRef);
  if (!refs.includes(field.ref)) refs.push(field.ref);

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!page) continue;
    if (refs.some((ref) => annotsContain(page, ref))) return index;
  }
  return null;
}

/**
 * Widget rectangles are PDF user-space points (origin bottom-left).
 * The editor uses a normalized crop-box box with origin top-left.
 */
function normalizeRect(
  rect: { x: number; y: number; width: number; height: number },
  crop: CropBox,
): NormalizedBox | null {
  if (!(crop.width > 0) || !(crop.height > 0)) return null;
  const x = (rect.x - crop.x) / crop.width;
  const w = rect.width / crop.width;
  const y = (crop.y + crop.height - (rect.y + rect.height)) / crop.height;
  const h = rect.height / crop.height;
  if (![x, y, w, h].every((value) => Number.isFinite(value))) return null;
  return { x, y, w, h };
}

function denormalize(
  box: { x: number; y: number; w: number; h: number },
  crop: CropBox,
): { x: number; y: number; width: number; height: number } {
  const width = box.w * crop.width;
  const height = box.h * crop.height;
  return {
    x: crop.x + box.x * crop.width,
    y: crop.y + crop.height - box.y * crop.height - height,
    width,
    height,
  };
}

function placement(doc: PDFDocument, field: PDFField): Pick<AcroFieldInfo, "page" | "x" | "y" | "w" | "h"> {
  let widgets: PDFWidgetAnnotation[] = [];
  try {
    widgets = field.acroField.getWidgets();
  } catch {
    return { ...NULL_PLACEMENT };
  }
  if (widgets.length === 0) return { ...NULL_PLACEMENT };

  const pages = doc.getPages();
  for (const widget of widgets) {
    if (!widget.Rect()) continue;
    const page = pageIndexForWidget(doc, field, widget);
    if (page === null) continue;
    const pageObj = pages[page];
    if (!pageObj) continue;
    const normalized = normalizeRect(widget.getRectangle(), pageObj.getCropBox());
    if (!normalized) continue;
    return { page, ...normalized };
  }
  return { ...NULL_PLACEMENT };
}

export async function inspectAcroForm(bytes: Uint8Array): Promise<{
  pageCount: number;
  sha256: string;
  fields: AcroFieldInfo[];
  hasAcroForm: boolean;
}> {
  const sha256 = sha256Hex(bytes);
  const doc = await loadPdf(bytes, "inspection");
  // getForm() creates an AcroForm when one is missing, so detect first.
  const hasAcroForm = doc.catalog.getAcroForm() !== undefined;
  const formFields = hasAcroForm ? doc.getForm().getFields() : [];
  const fields: AcroFieldInfo[] = formFields.map((field) => ({
    name: field.getName(),
    type: fieldType(field),
    options: readOptions(field),
    ...placement(doc, field),
  }));
  return {
    pageCount: doc.getPageCount(),
    sha256,
    fields,
    hasAcroForm,
  };
}

function checkboxState(value: string | boolean): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase();
  if (token === "true" || token === "yes" || token === "1") return true;
  if (token === "false" || token === "no" || token === "0" || token === "off" || token === "") return false;
  return null;
}

function assertKnownOption(field: PDFRadioGroup | PDFDropdown | PDFOptionList, value: string): void {
  const options = field.getOptions();
  if (!options.includes(value)) {
    throw new Error(`Option "${value}" is not valid for ${field.getName()}`);
  }
}

function applyFieldValue(field: PDFField, value: string | boolean): void {
  if (field instanceof PDFTextField) {
    field.setText(typeof value === "boolean" ? (value ? "true" : "false") : String(value));
    return;
  }
  if (field instanceof PDFCheckBox) {
    const state = checkboxState(value);
    if (state === null) {
      throw new Error(`Cannot coerce checkbox value for ${field.getName()}`);
    }
    if (state) field.check();
    else field.uncheck();
    return;
  }
  if (field instanceof PDFRadioGroup) {
    if (typeof value !== "string") throw new Error(`Option value must be a string for ${field.getName()}`);
    assertKnownOption(field, value);
    field.select(value);
    return;
  }
  if (field instanceof PDFDropdown) {
    if (typeof value !== "string") throw new Error(`Option value must be a string for ${field.getName()}`);
    assertKnownOption(field, value);
    field.select(value);
    return;
  }
  if (field instanceof PDFOptionList) {
    if (typeof value !== "string") throw new Error(`Option value must be a string for ${field.getName()}`);
    assertKnownOption(field, value);
    field.select(value);
    return;
  }
  throw new Error(`Unsupported field type for ${field.getName()}`);
}

export async function fillAcroForm(
  bytes: Uint8Array,
  values: Record<string, string | boolean>,
  opts?: { flatten?: boolean },
): Promise<{ bytes: Uint8Array; sha256: string; filled: string[]; missing: string[] }> {
  const doc = await loadPdf(bytes, "fill");
  const form = doc.getForm();
  const filled: string[] = [];
  const missing: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(key);
    if (!field) {
      missing.push(key);
      continue;
    }
    try {
      applyFieldValue(field, value);
      filled.push(key);
    } catch {
      missing.push(key);
    }
  }

  if (opts?.flatten) {
    form.flatten();
  }

  const out = await doc.save();
  return { bytes: out, sha256: sha256Hex(out), filled, missing };
}

function drawableTitle(title: string): string {
  let out = "";
  for (const ch of title) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) out += ch;
    else if (code > 126) out += "?";
  }
  return out.trim();
}

export async function placeFieldsOnBlank(input: {
  title: string;
  pages: number;
  fields: {
    name: string;
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
    kind: "text" | "checkbox";
  }[];
}): Promise<Uint8Array> {
  if (!Number.isInteger(input.pages) || input.pages < 1) {
    throw new Error(`pages must be a positive integer (received ${String(input.pages)})`);
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(input.title);
  const pages: PDFPage[] = [];
  for (let index = 0; index < input.pages; index += 1) {
    pages.push(pdfDoc.addPage(PageSizes.Letter));
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const title = drawableTitle(input.title);
  const first = pages[0];
  if (title && first) {
    first.drawText(title, {
      x: 48,
      y: first.getHeight() - 42,
      size: 14,
      font,
      color: rgb(0.12, 0.16, 0.22),
    });
  }

  const form = pdfDoc.getForm();
  const seen = new Set<string>();
  for (const field of input.fields) {
    if (typeof field.name !== "string" || field.name.trim() === "") {
      throw new Error("Field name must be a non-empty string");
    }
    if (seen.has(field.name)) throw new Error(`Duplicate PDF field name "${field.name}"`);
    seen.add(field.name);
    if (!Number.isInteger(field.page) || field.page < 0 || field.page >= pages.length) {
      throw new Error(`Field "${field.name}" page ${field.page} is outside 0..${pages.length - 1}`);
    }
    if (![field.x, field.y, field.w, field.h].every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new Error(`Field "${field.name}" has a non-finite box`);
    }
    if (!(field.w > 0) || !(field.h > 0)) {
      throw new Error(`Field "${field.name}" width and height must be positive`);
    }

    const page = pages[field.page];
    if (!page) throw new Error(`Field "${field.name}" page ${field.page} is missing`);
    const rect = denormalize(field, page.getCropBox());
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      color: rgb(0.94, 0.96, 0.98),
      borderColor: rgb(0.62, 0.68, 0.76),
      borderWidth: 0.75,
    });

    if (field.kind === "text") {
      const textField = form.createTextField(field.name);
      textField.addToPage(page, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        font,
        textColor: rgb(0.1, 0.12, 0.16),
        backgroundColor: rgb(1, 1, 1),
        borderColor: rgb(0.45, 0.5, 0.58),
        borderWidth: 0,
      });
    } else if (field.kind === "checkbox") {
      const box = form.createCheckBox(field.name);
      box.addToPage(page, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        textColor: rgb(0.1, 0.12, 0.16),
        backgroundColor: rgb(1, 1, 1),
        borderColor: rgb(0.45, 0.5, 0.58),
        borderWidth: 0,
      });
    } else {
      throw new Error(`Field "${field.name}" kind is not supported by placeFieldsOnBlank`);
    }
  }

  return pdfDoc.save();
}

function foldKey(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function matchRank(fieldName: string, formKey: string): number {
  if (fieldName === formKey) return 3;
  if (fieldName.toLowerCase() === formKey.toLowerCase()) return 2;
  const left = foldKey(fieldName);
  const right = foldKey(formKey);
  if (left.length > 0 && left === right) return 1;
  return 0;
}

export function mapFields(
  fields: AcroFieldInfo[],
  formKeys: string[],
): { mapped: { pdfField: string; formKey: string }[]; unmapped: string[] } {
  const used = new Set<number>();
  const mapped: { pdfField: string; formKey: string }[] = [];
  const unmapped: string[] = [];

  for (const field of fields) {
    let bestIndex = -1;
    let bestRank = 0;
    for (let index = 0; index < formKeys.length; index += 1) {
      if (used.has(index)) continue;
      const key = formKeys[index];
      if (key === undefined) continue;
      const rank = matchRank(field.name, key);
      if (rank > bestRank) {
        bestRank = rank;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) {
      const formKey = formKeys[bestIndex];
      if (formKey === undefined) {
        unmapped.push(field.name);
        continue;
      }
      used.add(bestIndex);
      mapped.push({ pdfField: field.name, formKey });
    } else {
      unmapped.push(field.name);
    }
  }

  return { mapped, unmapped };
}
