import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, trapTab, validationAnnouncement, wcagAA } from "./keyboard.ts";
import { formatCurrency, formMessages } from "../i18n/format.ts";
import { runGridBench, virtualRange } from "../perf/bench.ts";

test("focus trap, contrast, and locale formatters", () => {
  assert.equal(trapTab(0, 3, true), 2);
  assert.equal(validationAnnouncement([{ label: "Email", message: "Required" }]), "1 error. Email: Required");
  assert.ok(contrastRatio("#121316", "#f3f2ee") >= 4.5);
  assert.equal(wcagAA("#121316", "#f3f2ee"), true);
  assert.equal(formMessages("es-MX").publish, "Publicar");
  assert.ok(formatCurrency(12.5, "en-US", "USD").includes("12.50"));
});

test("a 10000-row grid window stays small", () => {
  const range = virtualRange(10000, 480, 32, 0);
  assert.ok(range.end - range.start < 40);
  const report = runGridBench();
  assert.ok(report.every((row) => row.window < 40));
});
