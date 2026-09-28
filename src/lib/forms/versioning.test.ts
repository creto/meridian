import assert from "node:assert/strict";
import test from "node:test";
import type { FormDefinition } from "./types.ts";
import { restoreVersionAsDraft } from "./versioning.ts";

function form(): FormDefinition {
  const now = "2026-09-28T00:00:00.000Z";
  return {
    id: "frm",
    name: "intake",
    title: "Current",
    description: "",
    display: "form",
    status: "published",
    version: 2,
    hasUnpublishedChanges: false,
    components: [{ id: "a", type: "textfield", key: "now", label: "Now" }],
    settings: { submitLabel: "Send", draftLabel: "Save", successMessage: "Ok", allowDraft: true },
    tags: [],
    createdAt: now,
    updatedAt: now,
    versions: [
      {
        version: 1,
        savedAt: now,
        note: "first",
        title: "Original",
        display: "wizard",
        components: [{ id: "b", type: "email", key: "email", label: "Email" }],
      },
    ],
    activity: [],
    pdfPages: 1,
  };
}

test("restore copies history into the draft and leaves the version row intact", () => {
  const source = form();
  const restored = restoreVersionAsDraft(source, 1, "ada");
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.form.title, "Original");
  assert.equal(restored.form.display, "wizard");
  assert.equal(restored.form.components[0]?.key, "email");
  assert.equal(restored.form.hasUnpublishedChanges, true);
  assert.equal(restored.form.versions[0]?.title, "Original");
  assert.equal(source.components[0]?.key, "now");
  assert.equal(restoreVersionAsDraft(source, 9).ok, false);
});
