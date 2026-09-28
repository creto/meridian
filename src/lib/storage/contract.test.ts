import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createMemoryStorage } from "./object-contract.ts";
import type { ObjectStorageProvider } from "./object-contract.ts";

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Shared object-storage contract. Memory passes; S3, GCS, and Azure are not claimed complete. */
export async function assertObjectContract(provider: ObjectStorageProvider): Promise<void> {
  const body = new TextEncoder().encode("hello-meridian");
  const expected = sha256(body);
  const put = await provider.put({ key: "a/hello.txt", body, contentType: "text/plain" });
  assert.equal(put.ok, true);
  if (!put.ok) return;
  assert.equal(put.object.key, "a/hello.txt");
  assert.equal(put.object.bytes, body.byteLength);
  assert.equal(put.object.sha256, expected);

  const got = await provider.get("a/hello.txt");
  assert.equal(got.ok, true);
  if (!got.ok) return;
  assert.equal(Buffer.compare(Buffer.from(got.body), Buffer.from(body)), 0);
  assert.equal(got.object.sha256, expected);
  assert.equal(got.object.sha256, put.object.sha256);

  const missing = await provider.get("does/not/exist.txt");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "NOT_FOUND");

  await provider.put({ key: "a/nested/two.txt", body });
  await provider.put({ key: "b/other.txt", body });
  await provider.put({ key: "ab/not-prefix.txt", body });
  const listed = await provider.list("a/");
  const keys = listed.map((object) => object.key).sort();
  assert.deepEqual(keys, ["a/hello.txt", "a/nested/two.txt"]);
  assert.ok(listed.every((object) => object.key.startsWith("a/")));

  const removed = await provider.delete("a/hello.txt");
  assert.equal(removed.ok, true);
  assert.equal(await provider.exists("a/hello.txt"), false);
  assert.equal(await provider.exists("a/nested/two.txt"), true);

  const health = await provider.testConnection();
  assert.equal(health.ok, true);
  assert.equal(await provider.exists("meridian-healthcheck.txt"), false);
}

test("memory storage satisfies the object contract", async () => {
  await assertObjectContract(createMemoryStorage());
});
