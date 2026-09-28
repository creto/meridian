import assert from "node:assert/strict";
import test from "node:test";
import { readZipNames, submissionsToCsv, submissionsToNdjson, zipStore } from "./pack.ts";

test("csv and ndjson exports quote embedded commas", () => {
  const rows = [{ id: "s1", formId: "f", status: "submitted", createdAt: "2026-09-28T00:00:00.000Z", data: { name: "Ada, North" } }];
  assert.match(submissionsToCsv(rows, ["name"]), /"Ada, North"/);
  assert.equal(submissionsToNdjson(rows).split("\n").length, 1);
});

test("zip store round-trips entry names and rejects traversal", () => {
  const bytes = zipStore([
    { name: "submission.json", data: new TextEncoder().encode("{\"ok\":true}") },
    { name: "files/note.txt", data: new TextEncoder().encode("hello") },
  ]);
  assert.deepEqual(readZipNames(bytes), ["submission.json", "files/note.txt"]);
  assert.throws(() => zipStore([{ name: "../secret", data: new Uint8Array() }]));
});
