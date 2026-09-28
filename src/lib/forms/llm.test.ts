import assert from "node:assert/strict";
import test from "node:test";
import { actionsFromModel, applyOperations, extractJson, localAgent, proposalFromModel, sanitizeTree } from "./llm.ts";
import { supplierForm } from "./templates.ts";

test("extracts fenced JSON", () => {
  const value = extractJson("```json\n{\"reply\":\"ok\"}\n```");
  assert.deepEqual(value, { reply: "ok" });
});

test("edits a form from operations", () => {
  const form = supplierForm();
  const next = applyOperations(form.components, [
    { op: "update", match: "Address", required: false },
    { op: "add", parent: "Organization", component: { type: "url", key: "website", label: "Website", conditional: "supplierType == \"foreign\"" } },
  ]);
  const proposal = proposalFromModel(form, { reply: "Website for foreign suppliers.", summary: ["Address optional", "Added website"], operations: [
    { op: "update", match: "Address", required: false },
    { op: "add", parent: "Organization", component: { type: "url", key: "website", label: "Website", conditional: "supplierType == \"foreign\"" } },
  ] });
  assert.equal(next.issues.length, 0);
  assert.equal(proposal.valid, true);
  const website = proposal.components.find((item) => item.key === "organization")?.components?.find((item) => item.key === "website");
  assert.equal(website?.conditional, 'supplierType == "foreign"');
  assert.equal(proposal.components.find((item) => item.key === "organization")?.components?.find((item) => item.key === "address")?.required, false);
});

test("drops an unsafe show-when rule", () => {
  const form = supplierForm();
  const cleaned = sanitizeTree([{ id: "x", type: "textfield", key: "note", label: "Note", conditional: "alert(1)" }]);
  assert.equal(cleaned.components[0]?.conditional, undefined);
  assert.equal(cleaned.issues.length, 1);
  const ignored = proposalFromModel(form, { operations: [{ op: "update", match: "NIT", conditional: "alert(1)" }] });
  assert.equal(ignored.components.flatMap((item) => item.components ?? []).find((item) => item.key === "nit")?.conditional, 'supplierType == "colombian_company"');
  assert.ok(ignored.issues.some((issue) => /NIT/i.test(issue)));
});

test("reads agent actions", () => {
  const turned = actionsFromModel({
    reply: "Filing it.",
    actions: [
      { type: "submit", formId: "frm_supplier", data: { legalName: "Andes" }, idempotencyKey: "supplier-andes" },
      { type: "create_form", title: "Visitor badge", display: "form", components: [{ type: "textfield", key: "visitorName", label: "Name", required: true }] },
    ],
  }, "make a badge form");
  assert.equal(turned.actions.length, 2);
  assert.equal(turned.actions[0]?.type, "submit");
  assert.equal(turned.actions[1]?.type, "create_form");
});

test("local agent lists fields without inventing a submission", () => {
  const answer = localAgent("What is required on the supplier form?", [supplierForm()]);
  assert.equal(answer.actions.length, 0);
  assert.match(answer.reply, /NIT/);
  const create = localAgent("Create a form for a laptop request with name and email", [supplierForm()]);
  assert.equal(create.actions[0]?.type, "create_form");
});
