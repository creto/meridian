import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { defaultPlacement, exportOverlays, formatPdfValue, importOverlayList, overlayToPlacement, parseHex, placementToOverlay, renderFormPdf, sampleSubmission } from "./pdf-layout.ts";
import type { FormComponent } from "./types.ts";

function field(partial: Partial<FormComponent> & Pick<FormComponent, "type" | "key">): FormComponent {
  return { id: partial.key, label: partial.label ?? partial.key, ...partial };
}

test("Form.io overlay pixels convert to page percents and back", () => {
  const pdf = overlayToPlacement({ page: "2", left: "61.2px", top: "79.2px", width: "306px", height: "39.6px" });
  assert.ok(pdf);
  assert.equal(pdf?.page, 2);
  assert.ok(Math.abs((pdf?.x ?? 0) - 10) < 0.05);
  assert.ok(Math.abs((pdf?.y ?? 0) - 10) < 0.05);
  assert.ok(Math.abs((pdf?.w ?? 0) - 50) < 0.05);
  const overlay = placementToOverlay(pdf!);
  const again = overlayToPlacement(overlay);
  assert.equal(again?.page, 2);
  assert.ok(Math.abs((again?.x ?? 0) - (pdf?.x ?? 0)) < 0.2);
});

test("percent overlays stay percents", () => {
  const pdf = overlayToPlacement({ page: 1, left: 12, top: 20, width: 30, height: 6 });
  assert.equal(pdf?.x, 12);
  assert.equal(pdf?.w, 30);
});

test("filled PDF downloads as a real document with the sample value", async () => {
  const components = [
    field({ type: "textfield", key: "legalName", label: "Legal name", pdf: { ...defaultPlacement(0), showLabel: false } }),
    field({ type: "checkbox", key: "agree", label: "Agree", pdf: { ...defaultPlacement(1), x: 8, y: 20, w: 6, h: 4 } }),
    field({ type: "currency", key: "amount", label: "Amount", currency: "USD", pdf: { ...defaultPlacement(2), format: "currency" } }),
  ];
  const data = { ...sampleSubmission(components), legalName: "Northwind Traders", agree: true, amount: 42 };
  assert.equal(formatPdfValue(components[2]!, 42), "$42.00");
  const bytes = await renderFormPdf({ title: "Vendor", pageCount: 1, components, data, mode: "filled" });
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2);
  const overlays = exportOverlays(components);
  const imported = importOverlayList({ components: overlays });
  assert.equal(imported.length, 3);
  assert.equal(imported[0]?.key, "legalName");
});

test("accent colors parse and a styled record still builds", async () => {
  assert.deepEqual(parseHex("#1c3d36"), { r: 28 / 255, g: 61 / 255, b: 54 / 255 });
  assert.equal(parseHex("nope").r, 0.11);
  const bytes = await renderFormPdf({
    title: "Styled",
    pageCount: 1,
    components: [field({ type: "textfield", key: "name", label: "Name", pdf: defaultPlacement(0) })],
    data: { name: "Ada" },
    mode: "filled",
    theme: { accent: "#1c3d36", columns: 2, zebra: true, header: true, border: "underline" },
  });
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
});

test("a PDF with no placements still downloads", async () => {
  const bytes = await renderFormPdf({
    title: "Empty",
    pageCount: 1,
    components: [field({ type: "email", key: "email", label: "Email" })],
    data: { email: "ada@example.com" },
    mode: "filled",
  });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
});
