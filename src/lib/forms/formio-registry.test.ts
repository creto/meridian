import assert from "node:assert/strict";
import { test } from "node:test";
import { allRegistryEntries, registryEntry, UNSUPPORTED_TYPES } from "./component-registry.ts";
import { importFormioNode, importFormioTree, supportSummary } from "./formio-registry.ts";
import type { ComponentType } from "./types.ts";

const ADAPTERS: [string, ComponentType][] = [
  ["textfield", "textfield"],
  ["textarea", "textarea"],
  ["number", "number"],
  ["email", "email"],
  ["phoneNumber", "phone"],
  ["url", "url"],
  ["select", "select"],
  ["radio", "radio"],
  ["checkbox", "checkbox"],
  ["selectboxes", "selectboxes"],
  ["datetime", "datetime"],
  ["day", "date"],
  ["time", "time"],
  ["currency", "currency"],
  ["file", "file"],
  ["signature", "signature"],
  ["address", "address"],
  ["panel", "panel"],
  ["columns", "columns"],
  ["tabs", "tabs"],
  ["datagrid", "datagrid"],
  ["editgrid", "datagrid"],
  ["container", "container"],
  ["content", "content"],
  ["htmlelement", "content"],
  ["button", "button"],
  ["hidden", "hidden"],
  ["survey", "radio"],
  ["recaptcha", "captcha"],
];

test("registry covers every component type and refuses schema gaps", () => {
  const entries = allRegistryEntries();
  assert.equal(entries.length, 32);
  assert.equal(new Set(entries.map((entry) => entry.type)).size, 32);
  for (const entry of entries) {
    assert.equal(registryEntry(entry.type), entry);
    assert.equal(entry.defaultRequired, false);
    assert.equal(typeof entry.jsonSchema, "function");
    assert.ok(entry.agentHint.endsWith("."));
    const schema = entry.jsonSchema({
      id: entry.type,
      type: entry.type,
      key: entry.type,
      label: entry.label,
    });
    assert.equal(typeof schema, "object");
    assert.ok(schema);
  }
  assert.equal(registryEntry("content").acceptsLogic, false);
  assert.equal(registryEntry("button").acceptsLogic, false);
  assert.equal(registryEntry("review").acceptsLogic, false);
  assert.equal(registryEntry("textfield").acceptsLogic, true);
  assert.equal(registryEntry("panel").group, "layout");
  assert.equal(registryEntry("select").group, "choice");
  assert.ok(registryEntry("radio").formioTypes.includes("survey"));
  assert.ok(registryEntry("phone").formioTypes.includes("phoneNumber"));
  assert.ok(registryEntry("datagrid").formioTypes.includes("editgrid"));
  assert.ok(registryEntry("date").formioTypes.includes("day"));
  assert.ok(registryEntry("content").formioTypes.includes("htmlelement"));
  assert.ok(registryEntry("captcha").formioTypes.includes("recaptcha"));

  const selectSchema = registryEntry("select").jsonSchema({
    id: "s",
    type: "select",
    key: "color",
    label: "Color",
    values: [
      { label: "Red", value: "red" },
      { label: "Blue", value: "blue" },
    ],
  });
  assert.equal(selectSchema.type, "string");
  assert.deepEqual(selectSchema.enum, ["red", "blue"]);

  const textSchema = registryEntry("textfield").jsonSchema({
    id: "t",
    type: "textfield",
    key: "code",
    label: "Code",
    description: "Account",
    validate: { pattern: "^[A-Z]+$", minLength: 2, maxLength: 4 },
  });
  assert.equal(textSchema.pattern, "^[A-Z]+$");
  assert.equal(textSchema.minLength, 2);
  assert.equal(textSchema.maxLength, 4);
  assert.equal(textSchema.description, "Account");

  const panelSchema = registryEntry("panel").jsonSchema({
    id: "p",
    type: "panel",
    key: "section",
    label: "Section",
    components: [{ id: "e", type: "email", key: "email", label: "Email", required: true }],
  });
  const properties = panelSchema.properties as Record<string, { format?: string }>;
  assert.equal(properties.email?.format, "email");
  assert.deepEqual(panelSchema.required, ["email"]);

  for (const name of [
    "percentage",
    "tags",
    "image",
    "accordion",
    "key-value",
    "json editor",
    "lookup",
  ]) {
    const item = UNSUPPORTED_TYPES.find((entry) => entry.name === name);
    assert.ok(item, name);
    assert.match(item.reason, /not in the ComponentType schema yet/i);
  }
});

test("Form.io select values import fully and are kept", () => {
  const node = importFormioNode({
    type: "select",
    key: "color",
    label: "Color",
    input: true,
    values: [
      { label: "Red", value: "red" },
      { label: "New York", value: "new-york" },
    ],
  });
  assert.equal(node.support, "FULLY_SUPPORTED");
  assert.equal(node.component.type, "select");
  assert.equal(node.component.key, "color");
  assert.deepEqual(node.component.values, [
    { label: "Red", value: "red" },
    { label: "New York", value: "new-york" },
  ]);

  const fromData = importFormioNode({
    type: "select",
    key: "size",
    label: "Size",
    data: { values: [{ label: "Small", value: "s" }] },
    validate: { required: true },
  });
  assert.equal(fromData.support, "FULLY_SUPPORTED");
  assert.equal(fromData.component.required, true);
  assert.deepEqual(fromData.component.values, [{ label: "Small", value: "s" }]);
});

test("customConditional is kept as a note and is not executable", () => {
  const script = `${"show = data.foo === 'bar';".padEnd(250, "x")}`;
  const node = importFormioNode({
    type: "textfield",
    key: "name",
    label: "Name",
    customConditional: script,
    calculateValue: "age + 1",
    conditional: { show: true, when: "country", eq: "CO" },
  });
  assert.equal(node.support, "PARTIALLY_SUPPORTED");
  assert.equal(node.component.conditional, undefined);
  assert.equal(node.component.calculateValue, undefined);
  assert.match(node.component.legacyNote ?? "", /not imported/);
  const conditionalWarning = node.warnings.find((warning) => warning.includes("customConditional"));
  assert.ok(conditionalWarning);
  assert.ok(conditionalWarning.includes(script.slice(0, 180)));
  assert.equal(conditionalWarning.includes(script.slice(0, 181)), false);
  const calculateWarning = node.warnings.find((warning) => warning.includes("calculateValue"));
  assert.ok(calculateWarning?.includes("age + 1"));
});

test("simple conditional JSON translates only when it is a safe equality", () => {
  const safe = importFormioNode({
    type: "textfield",
    key: "nit",
    label: "NIT",
    conditional: { show: true, when: "supplier_type", eq: "co_ok" },
  });
  assert.equal(safe.support, "FULLY_SUPPORTED");
  assert.equal(safe.component.conditional, 'supplier_type == "co_ok"');

  const unsafe = importFormioNode({
    type: "textfield",
    key: "nit",
    label: "NIT",
    conditional: { show: true, when: "country.code", eq: "C O" },
  });
  assert.equal(unsafe.support, "PARTIALLY_SUPPORTED");
  assert.equal(unsafe.component.conditional, undefined);

  const hidden = importFormioNode({
    type: "number",
    key: "qty",
    label: "Qty",
    conditional: { show: false, when: "ready", eq: "yes" },
  });
  assert.equal(hidden.support, "PARTIALLY_SUPPORTED");
  assert.equal(hidden.component.conditional, undefined);
});

test("unknown widget is unsupported text, keeps the label, and names dropped properties", () => {
  const node = importFormioNode({
    type: "superWidget",
    key: "keep_key",
    label: "Keep me",
    secretSauce: "drop-me",
    anotherDropped: { nested: true },
  });
  assert.equal(node.support, "UNSUPPORTED");
  assert.equal(node.component.type, "textfield");
  assert.equal(node.component.label, "Keep me");
  assert.equal(node.component.key, "keep_key");
  assert.equal(node.component.conditional, undefined);
  assert.match(node.component.legacyNote ?? "", /superWidget/);
  assert.ok(node.warnings.some((warning) => warning.includes("secretSauce")));
  assert.ok(node.warnings.some((warning) => warning.includes("anotherDropped")));
  assert.match(node.component.legacyNote ?? "", /secretSauce/);
});

test("survey maps to radio and every registered source type imports", () => {
  const survey = importFormioNode({
    type: "survey",
    key: "satisfaction",
    label: "Satisfaction",
    questions: [{ label: "How was it?", value: "how" }],
    values: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  });
  assert.equal(survey.component.type, "radio");
  assert.deepEqual(survey.component.values, [
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" },
  ]);
  assert.match(survey.component.description ?? "", /How was it/);

  for (const [sourceType, target] of ADAPTERS) {
    const node = importFormioNode({ type: sourceType, key: "field", label: "Field" });
    assert.equal(node.component.type, target, sourceType);
    assert.notEqual(node.support, "UNSUPPORTED", sourceType);
  }

  const hidden = importFormioNode({ type: "hidden", key: "token", label: "Token" });
  assert.equal(hidden.component.hidden, true);

  const columns = importFormioNode({
    type: "columns",
    key: "cols",
    label: "Columns",
    columns: [
      { width: 8, components: [{ type: "email", key: "email", label: "Email" }] },
      { size: 4, components: [{ type: "number", key: "qty", label: "Qty" }] },
    ],
  });
  assert.equal(columns.component.columns?.[0]?.width, 8);
  assert.equal(columns.component.columns?.[0]?.components[0]?.type, "email");
  assert.equal(columns.component.columns?.[1]?.components[0]?.key, "qty");

  const tree = importFormioTree({
    title: "Intake",
    display: "wizard",
    components: [
      { type: "textfield", key: "name", label: "Name" },
      {
        type: "panel",
        key: "page",
        label: "Page",
        components: [{ type: "mystery", key: "m", label: "Mystery", secretSauce: 1 }],
      },
      {
        type: "textfield",
        key: "note",
        label: "Note",
        customConditional: "show = true;",
      },
    ],
  });
  assert.equal(tree.title, "Intake");
  assert.equal(tree.display, "wizard");
  assert.equal(tree.components.length, 3);
  assert.equal(tree.components[0], tree.nodes[0]?.component);
  const nested = tree.components[1]?.components?.[0];
  assert.equal(nested?.type, "textfield");
  assert.equal(nested?.label, "Mystery");
  assert.match(nested?.legacyNote ?? "", /secretSauce/);
  assert.equal(tree.components[2]?.conditional, undefined);
  assert.deepEqual(supportSummary(tree.nodes), { full: 2, partial: 1, unsupported: 0 });
});
