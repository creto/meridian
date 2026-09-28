import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate } from "./expressions.ts";
import { applyCalculations, validateForm } from "./engine.ts";
import { generateFormFromText } from "./generate.ts";
import { parseCsv, profileColumns } from "./importing.ts";
import { importWorkbook } from "./spreadsheet.ts";
import { buildPdf } from "./pdf.ts";
import { supplierForm } from "./templates.ts";

test("calculated fields follow dependencies, not tree order", () => {
  const components = [
    { id: "q", type: "number" as const, key: "quantity", label: "Quantity" },
    { id: "t", type: "number" as const, key: "total", label: "Total", calculateValue: "extended * 2" },
    { id: "e", type: "number" as const, key: "extended", label: "Extended", calculateValue: "quantity * 5" },
  ];
  const data = applyCalculations(components, { quantity: 4, total: 0, extended: 0 });
  assert.equal(data.extended, 20);
  assert.equal(data.total, 40);
});

test("expressions compare, calculate, and aggregate", () => {
  const scope = {
    supplierType: "colombian_company",
    country: "CO",
    quantity: 2,
    unitPrice: 5,
    lines: [{ lineTotal: 10 }, { lineTotal: 4 }],
  };
  assert.equal(evaluate('supplierType == "colombian_company" and country == "CO"', scope).ok && (evaluate('supplierType == "colombian_company" and country == "CO"', scope) as { value: unknown }).value, true);
  assert.equal((evaluate("quantity * unitPrice", scope) as { value: unknown }).value, 10);
  assert.equal((evaluate('SUM(lines, "lineTotal")', scope) as { value: unknown }).value, 14);
  assert.equal((evaluate('AVG(lines, "lineTotal")', scope) as { value: unknown }).value, 7);
  assert.equal((evaluate("IF(quantity > 1, 3, 1)", scope) as { value: unknown }).value, 3);
  assert.equal((evaluate('COUNT(lines)', scope) as { value: unknown }).value, 2);
  assert.equal(evaluate("nope(", scope).ok, false);
});

test("supplier wizard hides NIT for foreign companies", () => {
  const form = supplierForm();
  const foreign = validateForm(form, {
    supplierType: "foreign",
    legalName: "Globex",
    country: "US",
    taxId: "98-1",
    repEmail: "a@b.co",
    paymentMethod: "check",
    address: { line1: "1 Main", city: "", region: "", postalCode: "", country: "" },
  });
  assert.equal(foreign.nit, undefined);
  assert.equal(foreign.legalName, undefined);
  const missingNit = validateForm(form, {
    supplierType: "colombian_company",
    legalName: "Andes",
    country: "CO",
    nit: "",
    repName: "Ana",
    repEmail: "ana@andes.co",
    paymentMethod: "check",
  });
  assert.match(missingNit.nit ?? "", /required/i);
});

test("grid formulas roll up", () => {
  const form = {
    display: "form" as const,
    components: [
      {
        id: "g",
        type: "datagrid" as const,
        key: "lines",
        label: "Lines",
        components: [
          { id: "q", type: "number" as const, key: "quantity", label: "Qty" },
          { id: "p", type: "currency" as const, key: "unitPrice", label: "Price" },
          { id: "t", type: "currency" as const, key: "lineTotal", label: "Total", calculateValue: "quantity * unitPrice" },
        ],
      },
      { id: "s", type: "currency" as const, key: "grandTotal", label: "Sum", calculateValue: 'SUM(lines, "lineTotal")' },
    ],
  };
  const next = applyCalculations(form.components, { lines: [{ quantity: 2, unitPrice: 5, lineTotal: 0 }], grandTotal: 0 });
  const rows = next.lines as { lineTotal: number }[];
  assert.equal(rows[0]?.lineTotal, 10);
  assert.equal(next.grandTotal, 10);
});

test("natural language supplier brief", () => {
  const form = generateFormFromText(
    "Necesito un formulario para registrar proveedores. Si es una empresa colombiana necesito NIT, razón social, representante legal, RUT y certificado bancario. Si es extranjera necesito Tax ID. Quiero que compras revise primero y después finanzas. Al aprobarse guarde el PDF final en nuestro ECM.",
  );
  assert.equal(form.display, "wizard");
  const keys = JSON.stringify(form.components);
  assert.match(keys, /nit/);
  assert.match(keys, /taxId/);
  assert.match(keys, /colombian_company/);
  assert.equal(form.workflow?.nodes.some((node) => node.role === "Procurement"), true);
  assert.equal(form.workflow?.nodes.some((node) => node.role === "Finance"), true);
});

test("csv profiling", () => {
  const parsed = parseCsv("Name,Email,Age\nAna,ana@example.com,32\nLuis,luis@example.com,28\n");
  const profiles = profileColumns(parsed.rows);
  assert.equal(profiles.find((p) => p.field === "Email")?.inferredType, "email");
  assert.equal(profiles.find((p) => p.field === "Age")?.inferredType, "number");
});

test("workbook reports every sheet and imports the chosen one", async () => {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Name", "Email"], ["Ana", "ana@example.com"]]), "People");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Field", "Type"], ["City", "text"]]), "Spec");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const first = await importWorkbook(bytes);
  assert.equal(first.sheetCount, 2);
  assert.equal(first.sheets.length, 2);
  assert.equal(first.sheetName, "People");
  assert.equal(first.mode, "data-profile");
  const spec = await importWorkbook(bytes, "Spec");
  assert.equal(spec.mode, "field-table");
  assert.equal(spec.components[0]?.label, "City");
  assert.equal(spec.components[0]?.type, "textfield");
});

test("pdf header", () => {
  const bytes = buildPdf([{ text: "Hola niño" }], { title: "Registro" });
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /^%PDF-1.4/);
  assert.match(text, /%%EOF/);
});
