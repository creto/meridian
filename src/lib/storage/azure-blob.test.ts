import assert from "node:assert/strict";
import test from "node:test";
import { azureAuthorization, createAzureBlobProvider } from "./azure-blob.ts";
import { assertObjectContract } from "./contract.test.ts";

test("Azure shared key changes when the secret changes", () => {
  const base = { method: "PUT", account: "meridian", container: "forms", key: "a.txt", accountKey: Buffer.from("secret").toString("base64"), contentType: "text/plain", contentLength: 3, date: "Mon, 28 Sep 2026 12:00:00 GMT" };
  const left = azureAuthorization(base);
  const right = azureAuthorization({ ...base, accountKey: Buffer.from("other").toString("base64") });
  assert.match(left, /^SharedKey meridian:/);
  assert.notEqual(left, right);
});

test("Azure blob provider satisfies the object contract", async () => {
  const objects = new Map<string, { body: Uint8Array; contentType: string; sha256: string }>();
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    assert.match(new Headers(init?.headers).get("authorization") ?? "", /^SharedKey /);
    if (url.searchParams.get("comp") === "list") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const blobs = [...objects.entries()].filter(([name]) => name.startsWith(prefix)).map(([name, value]) => `<Blob><Name>${name}</Name><Properties><Content-Length>${value.body.byteLength}</Content-Length><Content-Type>${value.contentType}</Content-Type></Properties><Metadata><Sha256>${value.sha256}</Sha256></Metadata></Blob>`).join("");
      return new Response(`<EnumerationResults><Blobs>${blobs}</Blobs></EnumerationResults>`);
    }
    const key = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
    if (method === "PUT") {
      const body = init?.body instanceof Uint8Array ? init.body : new Uint8Array();
      objects.set(key, { body, contentType: new Headers(init?.headers).get("content-type") ?? "application/octet-stream", sha256: new Headers(init?.headers).get("x-ms-meta-sha256") ?? "" });
      return new Response(null, { status: 201 });
    }
    if (method === "DELETE") {
      if (!objects.delete(key)) return new Response("missing", { status: 404 });
      return new Response(null, { status: 202 });
    }
    const found = objects.get(key);
    if (!found) return new Response("missing", { status: 404 });
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-length": String(found.body.byteLength), "content-type": found.contentType, "x-ms-meta-sha256": found.sha256 } });
    }
      return new Response(found.body as unknown as BodyInit, { status: 200, headers: { "content-type": found.contentType, "x-ms-meta-sha256": found.sha256 } });
  };
  const provider = createAzureBlobProvider({
    account: "meridian",
    container: "forms",
    accountKey: Buffer.from("secret-key").toString("base64"),
    fetchImpl,
    now: () => new Date("2026-09-28T12:00:00.000Z"),
  });
  await assertObjectContract(provider);
});
