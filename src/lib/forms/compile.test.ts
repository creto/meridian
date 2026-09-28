import assert from "node:assert/strict";
import { test } from "node:test";
import { createComponent } from "./catalog.ts";
import { compileForm, getCompiledForm, invalidateCompiled } from "./compile.ts";
import { newFormShell } from "./importing.ts";
import type { FormComponent, FormDefinition } from "./types.ts";

function shell(components: FormComponent[], patch: Partial<FormDefinition> = {}): FormDefinition {
  return newFormShell({ title: "Compile me", components, ...patch });
}

test("compileForm records a bad expression and still returns", () => {
  const name = createComponent("textfield", "name");
  name.label = "Name";
  name.conditional = "name === ";
  name.calculateValue = "SUM(";
  const city = createComponent("textfield", "city");
  city.conditional = 'country == "CO"';
  const columns = createComponent("columns", "cols");
  columns.columns = [
    { width: 8, components: [city] },
    { width: 4, components: [] },
  ];
  const qty = createComponent("number", "qty");
  qty.calculateValue = "price * 2";
  const grid = createComponent("datagrid", "lines");
  grid.components = [qty];
  const email = createComponent("email", "email");
  const person = createComponent("container", "person");
  person.components = [email];
  const note = createComponent("textarea", "note");
  const panel = createComponent("panel", "section");
  panel.components = [note];
  const alpha = createComponent("number", "alpha");
  alpha.calculateValue = "beta + 1";
  const beta = createComponent("number", "beta");
  beta.calculateValue = "alpha + 1";

  const compiled = compileForm(shell([name, columns, grid, person, panel, alpha, beta]));
  assert.equal(compiled.display, "form");
  assert.ok(compiled.compiledAt);
  assert.equal(Number.isNaN(Date.parse(compiled.compiledAt)), false);

  const broken = compiled.fields.find((field) => field.key === "name");
  assert.ok(broken);
  assert.equal(broken.conditionalAst, null);
  assert.equal(broken.calculateAst, null);
  assert.match(broken.error ?? "", /Unexpected|Missing|Invalid|end of expression/i);
  assert.ok(
    compiled.issues.some((issue) => issue.level === "error" && issue.code === "CONDITIONAL"),
  );
  assert.ok(
    compiled.issues.some((issue) => issue.level === "error" && issue.code === "CALCULATION"),
  );

  for (const key of ["city", "qty", "email", "note", "cols", "lines", "person", "section"]) {
    assert.ok(
      compiled.fields.some((field) => field.key === key),
      `missing ${key}`,
    );
  }
  const cityField = compiled.fields.find((field) => field.key === "city");
  assert.ok(cityField?.conditionalAst);
  assert.deepEqual(cityField?.dependencies, ["country"]);
  assert.equal(cityField?.visibleWithEmptyData, false);

  const qtyField = compiled.fields.find((field) => field.key === "qty");
  assert.ok(qtyField?.calculateAst);
  assert.deepEqual(qtyField?.dependencies, ["price"]);
  assert.equal(qtyField?.error, undefined);
  assert.equal(qtyField?.required, false);

  assert.ok(compiled.cycles.length >= 1);
  assert.ok(compiled.issues.some((issue) => issue.code === "CYCLE"));
  assert.ok(compiled.cycles.some((cycle) => cycle.includes("alpha") && cycle.includes("beta")));
});

test("compiled form cache follows version and component hash", () => {
  const form = shell([createComponent("textfield", "name")]);
  const first = getCompiledForm(form);
  const second = getCompiledForm(form);
  assert.equal(first, second);
  assert.notEqual(compileForm(form), compileForm(form));

  form.components = [...form.components, createComponent("number", "qty")];
  const changed = getCompiledForm(form);
  assert.notEqual(first, changed);
  assert.ok(changed.fields.some((field) => field.key === "qty"));
  assert.equal(getCompiledForm(form), changed);

  const versioned = form.version;
  form.version = versioned + 1;
  const nextVersion = getCompiledForm(form);
  assert.notEqual(changed, nextVersion);
  form.version = versioned;

  const other = shell([createComponent("email", "email")]);
  const otherCompiled = getCompiledForm(other);
  invalidateCompiled(form.id);
  assert.notEqual(getCompiledForm(form), nextVersion);
  assert.equal(getCompiledForm(other), otherCompiled);

  const again = getCompiledForm(form);
  invalidateCompiled(form.id);
  assert.notEqual(getCompiledForm(form), again);
});

test("compiled cache drops the oldest entry past 100", () => {
  const oldestForm = shell([createComponent("textfield", "oldest")]);
  const oldest = getCompiledForm(oldestForm);
  for (let i = 0; i < 120; i += 1) {
    getCompiledForm(shell([createComponent("number", `n${i}`)]));
  }
  assert.notEqual(getCompiledForm(oldestForm), oldest);
});
