import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency, formatDate, formatNumber, messages, plural, translate } from "./catalog.ts";

const amp = String.fromCharCode(38);

test("catalog covers the form product in en and es", () => {
  assert.ok(Object.keys(messages.en).length >= 40);
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.es).sort());
  assert.equal(translate("en", "action.submit"), "Submit");
  assert.equal(translate("es", "action.submit"), "Enviar");
  assert.equal(translate("es", "status.in_review"), "En revisión");
});

test("interpolated values escape < and &", () => {
  const out = translate("en", "validation.min", { min: "1<2&3" });
  assert.equal(out, `Enter at least 1${amp}lt;2${amp}amp;3`);
  assert.equal(out.includes("<"), false);
  const label = translate("es", "validation.required", { label: `<b>A ${amp} B</b>` });
  assert.equal(label.includes("<"), false);
  assert.ok(label.startsWith(`${amp}lt;b${amp}gt;A ${amp}amp; B${amp}lt;/b${amp}gt;`));
  assert.equal(translate("en", "validation.max", {}), "Enter at most {{max}}");
});

test("unknown locale falls back to en then the key", () => {
  assert.equal(translate("fr", "action.saveDraft"), translate("en", "action.saveDraft"));
  assert.equal(translate("fr", "missing.key"), "missing.key");
  assert.equal(translate("en", "missing.key"), "missing.key");
  assert.equal(translate("es", "not.in.catalog"), "not.in.catalog");
});

test("formats currency, numbers, dates, and plurals", () => {
  const usd = formatCurrency("en", 1234.5, "USD");
  assert.match(usd, /\$1,234\.50/);
  const eur = formatCurrency("es", 1234.5, "EUR").replace(/[\u00a0\u202f]/g, " ");
  assert.match(eur, /€/);
  assert.match(eur, /1\.234,50|1234,50/);
  assert.equal(formatCurrency("de", 10, "USD"), formatCurrency("en", 10, "USD"));
  assert.equal(formatNumber("en", 1000.5, 1), "1,000.5");
  const dated = formatDate("en", "2020-01-02T00:30:00.000Z");
  assert.match(dated, /2020/);
  assert.match(dated, /02/);
  assert.equal(plural("en", 1, { one: "{{count}} file", other: "{{count}} files" }), "1 file");
  assert.equal(plural("en", 2, { one: "{{count}} file", other: "{{count}} files" }), "2 files");
  assert.equal(plural("es", 1, { one: "{{count}} archivo", other: "{{count}} archivos" }), "1 archivo");
  assert.equal(plural("es", 0, { one: "{{count}} archivo", other: "{{count}} archivos" }), "0 archivos");
});
