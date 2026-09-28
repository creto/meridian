import assert from "node:assert/strict";
import test from "node:test";
import { attributeMap, createEmbedSession, parseAttributes, reduceEmbed, type EmbedSession } from "./contract.ts";

function session(mode: EmbedSession["mode"] = "create", data: Record<string, unknown> = { a: 1 }): EmbedSession {
  return createEmbedSession({ formId: "form_1", mode, locale: "en", data });
}

test("createEmbedSession clones data and starts unsubmitted", () => {
  const data = { a: 1, person: { name: "Ada" } };
  const created = createEmbedSession({ formId: "form_1", mode: "edit", locale: "en-US", data });
  data.a = 9;
  data.person.name = "Grace";
  assert.equal(created.formId, "form_1");
  assert.equal(created.mode, "edit");
  assert.equal(created.locale, "en-US");
  assert.equal(created.submitted, false);
  assert.equal(created.lastSubmitted, null);
  assert.deepEqual(created.errors, {});
  assert.deepEqual(created.data, { a: 1, person: { name: "Ada" } });
  assert.deepEqual(created.initialData, { a: 1, person: { name: "Ada" } });
  assert.notEqual(created.data, created.initialData);
});

test("readonly ignores set-field and set-data", () => {
  const created = session("readonly", { a: 1 });
  const field = reduceEmbed(created, { type: "set-field", field: "a", value: 2 });
  const replaced = reduceEmbed(created, { type: "set-data", data: { a: 3 } });
  assert.equal(field, created);
  assert.equal(replaced, created);
  assert.deepEqual(created.data, { a: 1 });

  const editing = reduceEmbed(created, { type: "set-mode", mode: "edit" });
  assert.notEqual(editing, created);
  assert.equal(editing.mode, "edit");
  const changed = reduceEmbed(editing, { type: "set-field", field: "b", value: true });
  assert.deepEqual(changed.data, { a: 1, b: true });
  assert.deepEqual(created.data, { a: 1 });
});

test("set-data replaces data, set-field merges, and other events update shell state", () => {
  let current = session("create", { a: 1, b: 2 });
  current = reduceEmbed(current, { type: "set-data", data: { c: 3 } });
  assert.deepEqual(current.data, { c: 3 });
  current = reduceEmbed(current, { type: "set-field", field: "d", value: 4 });
  assert.deepEqual(current.data, { c: 3, d: 4 });
  current = reduceEmbed(current, { type: "set-locale", locale: "fr" });
  current = reduceEmbed(current, { type: "set-errors", errors: { c: "required" } });
  const errors = { c: "required" };
  const withErrors = reduceEmbed(session(), { type: "set-errors", errors });
  errors.c = "changed";
  assert.equal(withErrors.errors.c, "required");
  assert.equal(current.locale, "fr");
  assert.deepEqual(current.errors, { c: "required" });
  assert.equal(current.mode, "create");
});

test("submit copies data into lastSubmitted and reset restores the initial data", () => {
  let current = session("edit", { person: { name: "Ada" } });
  current = reduceEmbed(current, { type: "set-field", field: "qty", value: 2 });
  current = reduceEmbed(current, { type: "set-errors", errors: { qty: "bad" } });
  current = reduceEmbed(current, { type: "set-locale", locale: "de" });
  const submitted = reduceEmbed(current, { type: "submit" });
  assert.equal(submitted.submitted, true);
  assert.deepEqual(submitted.lastSubmitted, { person: { name: "Ada" }, qty: 2 });
  assert.notEqual(submitted.lastSubmitted, submitted.data);
  const copy = submitted.lastSubmitted;
  assert.ok(copy);
  copy.person = { name: "Grace" };
  assert.deepEqual(submitted.data.person, { name: "Ada" });

  const later = reduceEmbed(submitted, { type: "set-field", field: "qty", value: 9 });
  assert.equal(later.lastSubmitted && (later.lastSubmitted.qty as number), 2);
  assert.equal(later.data.qty, 9);

  const reset = reduceEmbed(later, { type: "reset" });
  assert.deepEqual(reset.data, { person: { name: "Ada" } });
  assert.equal(reset.submitted, false);
  assert.equal(reset.lastSubmitted, null);
  assert.deepEqual(reset.errors, {});
  assert.equal(reset.locale, "de");
  assert.equal(reset.mode, "edit");
  assert.equal(reset.formId, "form_1");
});

test("readonly can still record errors and a submit snapshot", () => {
  const created = session("readonly", { a: 1 });
  const withErrors = reduceEmbed(created, { type: "set-errors", errors: { a: "locked" } });
  assert.notEqual(withErrors, created);
  assert.deepEqual(withErrors.errors, { a: "locked" });
  const submitted = reduceEmbed(withErrors, { type: "submit" });
  assert.equal(submitted.submitted, true);
  assert.deepEqual(submitted.lastSubmitted, { a: 1 });
});

test("attributeMap and parseAttributes are inverses", () => {
  const full = { formId: "form_1", mode: "edit" as const, locale: "en-US", theme: "dark" };
  const attrs = attributeMap(full);
  assert.deepEqual(attrs, {
    "data-form-id": "form_1",
    "data-mode": "edit",
    "data-locale": "en-US",
    "data-theme": "dark",
  });
  assert.deepEqual(parseAttributes(attrs), full);

  const withoutTheme = { formId: "form_1", mode: "readonly" as const, locale: "fr" };
  const slim = attributeMap(withoutTheme);
  assert.equal("data-theme" in slim, false);
  assert.deepEqual(parseAttributes(slim), withoutTheme);

  assert.deepEqual(parseAttributes({ "data-mode": "sideways", "data-extra": "ignore", "data-theme": null }), {});
});
