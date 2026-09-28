import assert from "node:assert/strict";
import test from "node:test";
import type { FormDefinition } from "../forms/types.ts";
import { validateAiPatch } from "./patch.ts";

function form(): FormDefinition {
  const now = "2026-09-28T00:00:00.000Z";
  return {
    id: "frm",
    name: "intake",
    title: "Intake",
    description: "",
    display: "form",
    status: "draft",
    version: 1,
    hasUnpublishedChanges: true,
    components: [{ id: "name", type: "textfield", key: "legalName", label: "Legal name", required: true }],
    settings: { submitLabel: "Send", draftLabel: "Save", successMessage: "Ok", allowDraft: true },
    tags: [],
    createdAt: now,
    updatedAt: now,
    versions: [],
    activity: [],
    pdfPages: 1,
  };
}

test("a patch with a broken expression is rejected before apply", () => {
  const verdict = validateAiPatch(form(), [{ op: "update", match: "legalName", conditional: ")))" }]);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.issues.length > 0);
});

test("a well formed add operation is accepted", () => {
  const verdict = validateAiPatch(form(), [{ op: "add", component: { type: "email", key: "email", label: "Email" } }]);
  assert.equal(verdict.ok, true, verdict.issues.join("; "));
});
