import assert from "node:assert/strict";
import test from "node:test";
import type { FormDefinition } from "../forms/types.ts";
import { importSubmissionRows, suggestMappings } from "./submission-map.ts";

function form(): FormDefinition {
  const now = "2026-09-28T00:00:00.000Z";
  return {
    id: "frm",
    name: "intake",
    title: "Intake",
    description: "",
    display: "form",
    status: "published",
    version: 1,
    hasUnpublishedChanges: false,
    components: [
      { id: "a", type: "textfield", key: "legalName", label: "Legal name", required: true },
      { id: "b", type: "number", key: "headcount", label: "Headcount" },
      { id: "c", type: "checkbox", key: "active", label: "Active" },
    ],
    settings: { submitLabel: "Send", draftLabel: "Save", successMessage: "Ok", allowDraft: false },
    tags: [],
    createdAt: now,
    updatedAt: now,
    versions: [],
    activity: [],
    pdfPages: 1,
  };
}

test("column mapping folds headers and import keeps partial failures", () => {
  const mappings = suggestMappings(["Legal Name", "Headcount", "Notes"], ["legalName", "headcount", "active"]);
  assert.deepEqual(mappings.map((item) => item.key), ["legalName", "headcount"]);
  const batch = importSubmissionRows(form(), [
    { "Legal Name": "Ada", Headcount: "1,200", Notes: "ignore" },
    { "Legal Name": "", Headcount: "2", Notes: "" },
  ], mappings);
  assert.equal(batch.accepted.length, 1);
  assert.equal(batch.accepted[0]?.data.headcount, 1200);
  assert.equal(batch.rejected.length, 1);
  assert.ok(batch.rejected[0]?.errors.legalName);
});
