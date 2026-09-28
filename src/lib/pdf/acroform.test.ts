import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { fillAcroForm, inspectAcroForm, mapFields, placeFieldsOnBlank, type AcroFieldInfo } from "./acroform.ts";

const TEMPLATE = {
  title: "Intake",
  pages: 2,
  fields: [
    { name: "Legal Name", page: 0, x: 0.1, y: 0.15, w: 0.55, h: 0.04, kind: "text" as const },
    { name: "City", page: 0, x: 0.1, y: 0.24, w: 0.4, h: 0.04, kind: "text" as const },
    { name: "Agree", page: 1, x: 0.12, y: 0.3, w: 0.05, h: 0.04, kind: "checkbox" as const },
  ],
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function near(actual: number | null, expected: number, label: string) {
  assert.equal(typeof actual, "number", `${label} is missing`);
  assert.ok(Math.abs((actual as number) - expected) <= 0.05, `${label}: ${actual} vs ${expected}`);
}

function fieldInfo(name: string, type: AcroFieldInfo["type"] = "text"): AcroFieldInfo {
  return { name, type, options: [], page: 0, x: 0, y: 0, w: 0.1, h: 0.05 };
}

describe("placeFieldsOnBlank and inspectAcroForm", () => {
  it("sees the placed text fields and checkbox, with crop-box coordinates", async () => {
    const bytes = await placeFieldsOnBlank(TEMPLATE);
    const info = await inspectAcroForm(bytes);

    assert.equal(info.hasAcroForm, true);
    assert.equal(info.pageCount, TEMPLATE.pages);
    assert.equal(info.sha256, sha256(bytes));
    assert.match(info.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      info.fields.map((field) => field.name).sort(),
      ["Agree", "City", "Legal Name"],
    );

    for (const spec of TEMPLATE.fields) {
      const found = info.fields.find((field) => field.name === spec.name);
      assert.ok(found, spec.name);
      assert.equal(found.type, spec.kind === "checkbox" ? "checkbox" : "text");
      assert.deepEqual(found.options, []);
      assert.equal(found.page, spec.page);
      near(found.x, spec.x, `${spec.name}.x`);
      near(found.y, spec.y, `${spec.name}.y`);
      near(found.w, spec.w, `${spec.name}.w`);
      near(found.h, spec.h, `${spec.name}.h`);
    }
  });

  it("reports no AcroForm on a blank document and rejects bytes that are not a PDF", async () => {
    const blank = await PDFDocument.create();
    blank.addPage();
    const bytes = await blank.save();
    const info = await inspectAcroForm(bytes);
    assert.equal(info.hasAcroForm, false);
    assert.deepEqual(info.fields, []);
    assert.equal(info.pageCount, 1);

    await assert.rejects(
      () => inspectAcroForm(Uint8Array.from([1, 2, 3, 4, 5])),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to load PDF for AcroForm inspection/);
        return true;
      },
    );
  });

  it("normalizes a widget against a crop box whose origin is not zero", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 600]);
    page.setCropBox(10, 20, 400, 500);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const form = doc.getForm();
    const text = form.createTextField("Offset");
    const crop = page.getCropBox();
    const spec = { x: 0.25, y: 0.2, w: 0.25, h: 0.1 };
    const width = spec.w * crop.width;
    const height = spec.h * crop.height;
    text.addToPage(page, {
      x: crop.x + spec.x * crop.width,
      y: crop.y + crop.height - spec.y * crop.height - height,
      width,
      height,
      font,
      borderWidth: 0,
    });
    const info = await inspectAcroForm(await doc.save());
    const field = info.fields.find((item) => item.name === "Offset");
    assert.ok(field);
    assert.equal(field.page, 0);
    near(field.x, spec.x, "offset.x");
    near(field.y, spec.y, "offset.y");
    near(field.w, spec.w, "offset.w");
    near(field.h, spec.h, "offset.h");
  });
});

describe("fillAcroForm", () => {
  it("sets text and checks the box, then reads the values back", async () => {
    const bytes = await placeFieldsOnBlank(TEMPLATE);
    const filled = await fillAcroForm(bytes, {
      "Legal Name": "Ada Lovelace",
      City: "London",
      Agree: true,
    });

    assert.deepEqual(filled.missing, []);
    assert.deepEqual(filled.filled, ["Legal Name", "City", "Agree"]);
    assert.match(filled.sha256, /^[0-9a-f]{64}$/);
    assert.equal(filled.sha256, sha256(filled.bytes));

    const doc = await PDFDocument.load(filled.bytes);
    const form = doc.getForm();
    assert.equal(form.getTextField("Legal Name").getText(), "Ada Lovelace");
    assert.equal(form.getTextField("City").getText(), "London");
    assert.equal(form.getCheckBox("Agree").isChecked(), true);
  });

  it("accepts checkbox strings true, yes, and 1", async () => {
    const bytes = await placeFieldsOnBlank({
      title: "Checks",
      pages: 1,
      fields: [
        { name: "A", page: 0, x: 0.1, y: 0.1, w: 0.04, h: 0.04, kind: "checkbox" },
        { name: "B", page: 0, x: 0.2, y: 0.1, w: 0.04, h: 0.04, kind: "checkbox" },
        { name: "C", page: 0, x: 0.3, y: 0.1, w: 0.04, h: 0.04, kind: "checkbox" },
      ],
    });
    const filled = await fillAcroForm(bytes, { A: "true", B: "Yes", C: "1" });
    assert.deepEqual(filled.missing, []);
    const form = (await PDFDocument.load(filled.bytes)).getForm();
    assert.equal(form.getCheckBox("A").isChecked(), true);
    assert.equal(form.getCheckBox("B").isChecked(), true);
    assert.equal(form.getCheckBox("C").isChecked(), true);
  });

  it("flattens to a reloadable PDF with no interactive fields", async () => {
    const bytes = await placeFieldsOnBlank(TEMPLATE);
    const before = await inspectAcroForm(bytes);
    const flat = await fillAcroForm(
      bytes,
      { "Legal Name": "Ada Lovelace", City: "London", Agree: "yes" },
      { flatten: true },
    );

    assert.match(flat.sha256, /^[0-9a-f]{64}$/);
    assert.notEqual(flat.sha256, before.sha256);
    assert.equal(new TextDecoder().decode(flat.bytes.subarray(0, 5)), "%PDF-");

    const doc = await PDFDocument.load(flat.bytes);
    assert.equal(doc.getPageCount(), before.pageCount);
    const form = doc.getForm();
    if (form.getFields().length !== 0) {
      assert.throws(() => form.getTextField("Legal Name"));
    }
  });

  it("reports a value for a field that does not exist and does not throw", async () => {
    const bytes = await placeFieldsOnBlank(TEMPLATE);
    const filled = await fillAcroForm(bytes, {
      "Legal Name": "Ada Lovelace",
      "Does Not Exist": "x",
      Agree: "yes",
    });
    assert.deepEqual(filled.missing, ["Does Not Exist"]);
    assert.deepEqual(filled.filled, ["Legal Name", "Agree"]);
    const form = (await PDFDocument.load(filled.bytes)).getForm();
    assert.equal(form.getTextField("Legal Name").getText(), "Ada Lovelace");
    assert.equal(form.getCheckBox("Agree").isChecked(), true);
    assert.equal(form.getTextField("City").getText(), undefined);
  });

  it("fills radio, dropdown, and option list, and skips unknown fields", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const form = doc.getForm();
    const radio = form.createRadioGroup("Choice");
    radio.addOptionToPage("Alpha", page, { x: 50, y: 700, width: 18, height: 18 });
    radio.addOptionToPage("Beta", page, { x: 50, y: 670, width: 18, height: 18 });
    const dropdown = form.createDropdown("Status");
    dropdown.addOptions(["Open", "Closed"]);
    dropdown.addToPage(page, { x: 50, y: 620, width: 140, height: 20, font });
    const list = form.createOptionList("Tags");
    list.addOptions(["Red", "Blue"]);
    list.addToPage(page, { x: 50, y: 520, width: 140, height: 50, font });
    const button = form.createButton("Submit");
    button.addToPage("Submit", page, { x: 50, y: 480, width: 80, height: 24, font });
    const bytes = await doc.save();

    const info = await inspectAcroForm(bytes);
    assert.equal(info.fields.find((field) => field.name === "Choice")?.type, "radio");
    assert.deepEqual(info.fields.find((field) => field.name === "Choice")?.options, ["Alpha", "Beta"]);
    assert.equal(info.fields.find((field) => field.name === "Status")?.type, "dropdown");
    assert.equal(info.fields.find((field) => field.name === "Tags")?.type, "option-list");
    assert.equal(info.fields.find((field) => field.name === "Submit")?.type, "unknown");

    const filled = await fillAcroForm(bytes, {
      Choice: "Beta",
      Status: "Closed",
      Tags: "Red",
      Submit: "click",
      "No Such": "x",
      ChoiceBad: "Z",
    });
    assert.deepEqual(filled.filled, ["Choice", "Status", "Tags"]);
    assert.deepEqual(filled.missing, ["Submit", "No Such", "ChoiceBad"]);

    const reloaded = (await PDFDocument.load(filled.bytes)).getForm();
    assert.equal(reloaded.getRadioGroup("Choice").getSelected(), "Beta");
    assert.deepEqual(reloaded.getDropdown("Status").getSelected(), ["Closed"]);
    assert.deepEqual(reloaded.getOptionList("Tags").getSelected(), ["Red"]);
  });
});

describe("mapFields", () => {
  it("maps Legal Name to legalName and does not map an unrelated field", () => {
    const result = mapFields(
      [fieldInfo("Legal Name"), fieldInfo("Favorite Color"), fieldInfo("E-mail"), fieldInfo("City")],
      ["legalName", "email", "city", "name"],
    );
    assert.deepEqual(result.mapped, [
      { pdfField: "Legal Name", formKey: "legalName" },
      { pdfField: "E-mail", formKey: "email" },
      { pdfField: "City", formKey: "city" },
    ]);
    assert.deepEqual(result.unmapped, ["Favorite Color"]);
    assert.equal(
      result.mapped.some((pair) => pair.formKey === "name" || pair.pdfField === "Favorite Color"),
      false,
    );

    const noGuess = mapFields([fieldInfo("Legal Name")], ["name"]);
    assert.deepEqual(noGuess.mapped, []);
    assert.deepEqual(noGuess.unmapped, ["Legal Name"]);
  });
});
