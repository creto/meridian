import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { createGcsProvider, signGcsV4 } from "./gcs-provider.ts";
import { assertObjectContract } from "./contract.test.ts";

test("GCS provider satisfies the object contract against a fake JSON API", async () => {
  const objects = new Map<string, { body: Uint8Array; contentType: string; sha256: string }>();
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname.endsWith("/o") && method === "POST") {
      const header = new Headers(init?.headers).get("content-type") ?? "";
      const boundary = /boundary=([^;]+)/.exec(header)?.[1] ?? "";
      const raw = init?.body instanceof Uint8Array ? init.body : new Uint8Array();
      const marker = new TextEncoder().encode(`--${boundary}`);
      const first = indexOf(raw, marker, 0);
      const second = indexOf(raw, marker, first + marker.length);
      const jsonStart = indexOf(raw, new TextEncoder().encode("\r\n\r\n"), first) + 4;
      const meta = JSON.parse(new TextDecoder().decode(raw.subarray(jsonStart, second - 2))) as { name: string; contentType: string; metadata: { meridian_sha256: string } };
      const fileStart = indexOf(raw, new TextEncoder().encode("\r\n\r\n"), second) + 4;
      const fileEnd = indexOf(raw, marker, fileStart);
      const body = raw.subarray(fileStart, fileEnd - 2);
      objects.set(meta.name, { body, contentType: meta.contentType, sha256: meta.metadata.meridian_sha256 });
      return json({ name: meta.name, size: String(body.byteLength), contentType: meta.contentType, metadata: meta.metadata });
    }
    const name = decodeURIComponent(url.pathname.split("/o/")[1] ?? "").replace(/\/$/, "");
    if (method === "DELETE") {
      if (!objects.has(name)) return new Response("missing", { status: 404 });
      objects.delete(name);
      return new Response(null, { status: 204 });
    }
    if (url.searchParams.get("alt") === "media") {
      const found = objects.get(name);
      if (!found) return new Response("missing", { status: 404 });
      return new Response(found.body as unknown as BodyInit, { status: 200, headers: { "content-type": found.contentType } });
    }
    if (url.pathname.endsWith("/o")) {
      const prefix = url.searchParams.get("prefix") ?? "";
      const items = [...objects.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({
        name: key,
        size: String(value.body.byteLength),
        contentType: value.contentType,
        metadata: { meridian_sha256: value.sha256 },
      }));
      return json({ items });
    }
    const found = objects.get(name);
    if (!found) return new Response("missing", { status: 404 });
    return json({ name, size: String(found.body.byteLength), contentType: found.contentType, metadata: { meridian_sha256: found.sha256 } });
  };
  const provider = createGcsProvider({ bucket: "forms", accessToken: "token", fetchImpl });
  await assertObjectContract(provider);
});

test("GCS V4 signed URLs are stable for the same instant", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const now = new Date("2026-09-28T12:00:00.000Z");
  const input = { clientEmail: "meridian@example.iam.gserviceaccount.com", privateKeyPem: pem, bucket: "forms", object: "a/b.pdf", now };
  const left = signGcsV4(input);
  const right = signGcsV4(input);
  assert.equal(left, right);
  assert.match(left, /x-goog-algorithm=GOOG4-RSA-SHA256/);
  assert.match(left, /x-goog-signature=[a-f0-9]{512}/);
  assert.throws(() => signGcsV4({ ...input, expiresSeconds: 0 }));
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  for (let index = from; index <= haystack.length - needle.length; index += 1) {
    let match = true;
    for (let cursor = 0; cursor < needle.length; cursor += 1) {
      if (haystack[index + cursor] !== needle[cursor]) {
        match = false;
        break;
      }
    }
    if (match) return index;
  }
  return -1;
}
