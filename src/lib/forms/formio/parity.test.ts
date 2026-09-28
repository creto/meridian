import assert from "node:assert/strict";
import { test } from "node:test";
import { createComponent } from "../catalog.ts";
import { applyClearOnHide, validateForm } from "../engine.ts";
import { importFormioNode } from "../formio-registry.ts";
import { proposalFromModel } from "../llm.ts";
import { applicableSettings, componentInventory, FORMIO_INVENTORY, upstreamType } from "./adapter.ts";
import { applyInputMask, parseByteLimit } from "./coerce.ts";
import { componentJson, readSetting, writeSetting } from "./document.ts";
import { applyJsonLogic } from "./json-logic.ts";
import { classifySetting } from "./parity-status.ts";
import type { FormDefinition } from "../types.ts";

test("inventory comes from the installed Form.io edit forms", () => {
  assert.equal(FORMIO_INVENTORY.package, "@formio/js");
  assert.equal(FORMIO_INVENTORY.version, "5.2.4");
  const text = componentInventory("textfield");
  const select = componentInventory("select");
  const file = componentInventory("file");
  const grid = componentInventory("datagrid");
  assert.ok(text && text.effectivePropertyCount >= 70);
  assert.ok(select && select.effectivePropertyCount >= 90);
  assert.ok(file && file.effectivePropertyCount >= 60);
  assert.ok(grid && grid.effectivePropertyCount >= 50);
  assert.ok(applicableSettings("textfield").some((setting) => setting.key === "inputMask"));
  assert.ok(applicableSettings("textfield").some((setting) => setting.key === "clearOnHide"));
  assert.ok(applicableSettings("select").some((setting) => setting.key === "dataSrc"));
  assert.equal(classifySetting("textfield", { key: "customConditional", editorType: "textarea" }).status, "INTENTIONALLY_UNSUPPORTED");
  assert.equal(classifySetting("textfield", { key: "placeholder", editorType: "textfield" }).status, "FULL");
});

test("nested settings round-trip without dropping unknown Form.io keys", () => {
  const imported = importFormioNode({
    type: "textfield",
    key: "code",
    label: "Code",
    inputMask: "999-999",
    tooltip: "Account",
    customClass: "mono",
    clearOnHide: false,
    weirdVendorFlag: { keep: true },
    validate: { required: true, pattern: "^[0-9-]+$", minLength: 3 },
  });
  assert.equal(imported.component.required, true);
  assert.equal(readSetting(imported.component, "inputMask"), "999-999");
  const renamed = writeSetting(imported.component, "label", "Account code");
  const masked = writeSetting(renamed, "prefix", "#");
  const exported = componentJson(masked);
  assert.equal(exported.label, "Account code");
  assert.equal(exported.inputMask, "999-999");
  assert.equal(exported.tooltip, "Account");
  assert.equal(exported.customClass, "mono");
  assert.equal(exported.prefix, "#");
  assert.deepEqual(exported.weirdVendorFlag, { keep: true });
  assert.equal((exported.validate as { pattern?: string }).pattern, "^[0-9-]+$");
  const again = importFormioNode(exported);
  assert.equal(readSetting(again.component, "inputMask"), "999-999");
  assert.equal(again.component.label, "Account code");
});

test("select data source visibility follows JSON Logic", () => {
  const component = createComponent("select", "color");
  const hidden = writeSetting(component, "dataSrc", "values");
  const url = writeSetting(hidden, "data.url", "https://example.com/colors.json");
  const rule = { "===": [{ var: "data.dataSrc" }, "url"] };
  assert.equal(applyJsonLogic(rule, { data: { dataSrc: "values" } }), false);
  assert.equal(applyJsonLogic(rule, { data: { dataSrc: readSetting(url, "dataSrc") } }), false);
  const switched = writeSetting(url, "dataSrc", "url");
  assert.equal(applyJsonLogic(rule, { data: { dataSrc: readSetting(switched, "dataSrc") } }), true);
  assert.equal(upstreamType(switched), "select");
});

test("mask, file size, clear-on-hide, and word limits affect runtime checks", () => {
  assert.equal(applyInputMask("999-99", "12345"), "123-45");
  assert.equal(parseByteLimit("1MB"), 1024 * 1024);
  const field = writeSetting(writeSetting(createComponent("textfield", "note"), "validate.minWords", 2), "clearOnHide", true);
  field.required = true;
  const form = {
    display: "form",
    components: [field],
  } as Pick<FormDefinition, "components" | "display">;
  assert.ok(validateForm(form, { note: "one" }).note);
  assert.equal(validateForm(form, { note: "two words" }).note, undefined);
  const hidden = writeSetting(createComponent("textfield", "secret"), "hidden", true);
  assert.equal(applyClearOnHide([hidden], { secret: "keep" }).secret, "");
  const kept = writeSetting(hidden, "clearOnHide", false);
  assert.equal(applyClearOnHide([kept], { secret: "keep" }).secret, "keep");
});

test("model patches reject unknown properties and keep known masks", () => {
  const base = {
    id: "form",
    name: "form",
    title: "Form",
    description: "",
    display: "form" as const,
    status: "draft" as const,
    version: 1,
    hasUnpublishedChanges: true,
    components: [createComponent("textfield", "code", "cmp")],
    settings: { submitLabel: "Send", draftLabel: "Save", successMessage: "OK", allowDraft: true },
    tags: [],
    createdAt: "",
    updatedAt: "",
    versions: [],
    activity: [],
    pdfPages: 1,
  };
  const proposal = proposalFromModel(base as FormDefinition, {
    reply: "mask",
    summary: ["mask"],
    operations: [{ op: "update", match: "code", formio: { inputMask: "999", notARealSetting: true } }],
  });
  assert.ok(proposal.issues.some((issue) => issue.includes("notARealSetting")));
  assert.equal(proposal.components[0]?.formio?.inputMask, "999");
});
