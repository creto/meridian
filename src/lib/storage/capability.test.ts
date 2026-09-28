import assert from "node:assert/strict";
import test from "node:test";
import { connectorMatrix, gapsFor, metadataHeader, normalizeStatus, planChunks } from "./capability.ts";

test("every connector has a cell for every capability", () => {
  const cells = connectorMatrix();
  const connectors = new Set(cells.map((cell) => cell.connector));
  const capabilities = new Set(cells.map((cell) => cell.capability));
  assert.equal(cells.length, connectors.size * capabilities.size);
  assert.ok(gapsFor("rest").some((cell) => cell.capability === "delete"));
  const summary = cells.filter((cell) => cell.support === "implemented");
  assert.ok(summary.length > 40);
});

test("chunk plans are 1-based and cover the byte range exactly", () => {
  const plan = planChunks(10, 4);
  assert.deepEqual(plan.parts.map((part) => [part.partNumber, part.start, part.end]), [
    [1, 0, 4],
    [2, 4, 8],
    [3, 8, 10],
  ]);
  assert.throws(() => planChunks(1, 0));
  assert.deepEqual(planChunks(0, 8).parts, []);
});

test("metadata headers reject line breaks and status codes classify retry", () => {
  assert.equal(metadataHeader({ Review: "ok" }, "x-ms-meta-")["x-ms-meta-review"], "ok");
  assert.throws(() => metadataHeader({ bad: "a\nb" }, "x-amz-meta-"));
  assert.equal(normalizeStatus(429, "slow").retryable, true);
  assert.equal(normalizeStatus(403, "no").code, "AUTH");
  assert.equal(normalizeStatus(500, "").retryable, true);
  assert.equal(normalizeStatus(404, "gone").retryable, false);
});
