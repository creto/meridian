import { createHash, createSign } from "node:crypto";
import type { ObjectStorageProvider, StoredObject } from "./object-contract.ts";

export interface GcsProviderOptions {
  bucket: string;
  accessToken: string;
  prefix?: string;
  fetchImpl?: typeof fetch;
  clientEmail?: string;
  privateKeyPem?: string;
}

interface GcsObjectJson {
  name?: string;
  size?: string;
  contentType?: string;
  md5Hash?: string;
  metadata?: { meridian_sha256?: string };
}

const HEALTH_KEY = "meridian-healthcheck.txt";

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function objectName(prefix: string | undefined, key: string): string {
  return `${prefix ?? ""}${key}`.replace(/^\/+/, "");
}

function encodedName(name: string): string {
  return name.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function fail(code: string, message: string) {
  return { ok: false as const, code, message };
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 300) || `HTTP ${response.status}`;
}

function toObject(json: GcsObjectJson, fallbackKey: string): StoredObject {
  const object: StoredObject = {
    key: json.name || fallbackKey,
    bytes: Number(json.size ?? 0),
    sha256: json.metadata?.meridian_sha256 || "",
  };
  if (json.contentType) object.contentType = json.contentType;
  return object;
}

export function createGcsProvider(options: GcsProviderOptions): ObjectStorageProvider {
  if (!options.bucket) throw new Error("GCS bucket is required");
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(options.bucket)}`;
  const upload = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(options.bucket)}/o`;

  async function call(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${options.accessToken}`);
    let response = await fetchImpl(url, { ...init, headers });
    if (response.status === 429 || response.status >= 500) {
      response = await fetchImpl(url, { ...init, headers });
    }
    return response;
  }

  async function metadata(name: string): Promise<GcsObjectJson | null> {
    const response = await call(`${root}/o/${encodedName(name)}`, { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()) as GcsObjectJson;
  }

  const provider: ObjectStorageProvider = {
    async put(input) {
      const name = objectName(options.prefix, input.key);
      const hash = sha256(input.body);
      const boundary = `meridian_${hash.slice(0, 12)}`;
      const meta = JSON.stringify({ name, contentType: input.contentType ?? "application/octet-stream", metadata: { meridian_sha256: hash } });
      const head = `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${input.contentType ?? "application/octet-stream"}\r\n\r\n`;
      const tail = `\r\n--${boundary}--`;
      const prefix = new TextEncoder().encode(head);
      const suffix = new TextEncoder().encode(tail);
      const body = new Uint8Array(prefix.length + input.body.length + suffix.length);
      body.set(prefix, 0);
      body.set(input.body, prefix.length);
      body.set(suffix, prefix.length + input.body.length);
      const response = await call(`${upload}?uploadType=multipart`, {
        method: "POST",
        headers: { "content-type": `multipart/related; boundary=${boundary}` },
        body: body as unknown as BodyInit,
      });
      if (!response.ok) return fail("GCS_PUT_FAILED", await readError(response));
      const json = (await response.json()) as GcsObjectJson;
      return { ok: true, object: { ...toObject(json, name), sha256: hash, bytes: input.body.byteLength, key: name } };
    },
    async get(key) {
      const name = objectName(options.prefix, key);
      const response = await call(`${root}/o/${encodedName(name)}?alt=media`, { method: "GET" });
      if (response.status === 404) return fail("NOT_FOUND", `Object not found: ${key}`);
      if (!response.ok) return fail("GCS_GET_FAILED", await readError(response));
      const bytes = new Uint8Array(await response.arrayBuffer());
      const info = await metadata(name);
      const object = info ? toObject(info, name) : { key: name, bytes: bytes.byteLength, sha256: sha256(bytes) };
      if (!object.sha256) object.sha256 = sha256(bytes);
      object.bytes = bytes.byteLength;
      return { ok: true, body: bytes, object };
    },
    async delete(key) {
      const name = objectName(options.prefix, key);
      const response = await call(`${root}/o/${encodedName(name)}`, { method: "DELETE" });
      if (response.status === 404) return fail("NOT_FOUND", `Object not found: ${key}`);
      if (!response.ok) return fail("GCS_DELETE_FAILED", await readError(response));
      return { ok: true };
    },
    async exists(key) {
      const info = await metadata(objectName(options.prefix, key));
      return info != null;
    },
    async stat(key) {
      const name = objectName(options.prefix, key);
      const info = await metadata(name);
      return info ? toObject(info, name) : null;
    },
    async list(prefix) {
      const full = objectName(options.prefix, prefix);
      const response = await call(`${root}/o?prefix=${encodeURIComponent(full)}`, { method: "GET" });
      if (!response.ok) throw new Error(await readError(response));
      const json = (await response.json()) as { items?: GcsObjectJson[] };
      return (json.items ?? []).map((item) => toObject(item, item.name || full)).sort((a, b) => a.key.localeCompare(b.key));
    },
    async testConnection() {
      const body = new TextEncoder().encode("meridian");
      const put = await provider.put({ key: HEALTH_KEY, body, contentType: "text/plain" });
      if (!put.ok) return put;
      const got = await provider.get(HEALTH_KEY);
      if (!got.ok) return got;
      const removed = await provider.delete(HEALTH_KEY);
      if (!removed.ok || got.object.sha256 !== sha256(body)) return fail("HEALTHCHECK_MISMATCH", "GCS health check did not round-trip");
      return { ok: true, message: "GCS put, get, and delete succeeded" };
    },
  };
  return provider;
}

/** GCS V4 signed URL. The signature covers the canonical request; it is not a live upload. */
export function signGcsV4(input: {
  clientEmail: string;
  privateKeyPem: string;
  bucket: string;
  object: string;
  method?: "GET" | "PUT";
  expiresSeconds?: number;
  now?: Date;
}): string {
  const method = input.method ?? "GET";
  const expires = input.expiresSeconds ?? 900;
  if (expires < 1 || expires > 604800) throw new Error("GCS signed URL expiry must be between 1 second and 7 days");
  const now = input.now ?? new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const datestamp = stamp.slice(0, 8);
  const credential = `${input.clientEmail}/${datestamp}/auto/storage/goog4_request`;
  const query = [
    ["x-goog-algorithm", "GOOG4-RSA-SHA256"],
    ["x-goog-credential", credential],
    ["x-goog-date", stamp],
    ["x-goog-expires", String(expires)],
    ["x-goog-signedheaders", "host"],
  ] as const;
  const canonicalQuery = query.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  const canonical = [method, `/${encodeURIComponent(input.bucket)}/${encodedName(input.object)}`, canonicalQuery, "host:storage.googleapis.com", "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const hash = createHash("sha256").update(canonical).digest("hex");
  const toSign = ["GOOG4-RSA-SHA256", stamp, `${datestamp}/auto/storage/goog4_request`, hash].join("\n");
  const signature = createSign("RSA-SHA256").update(toSign).sign(input.privateKeyPem).toString("hex");
  return `https://storage.googleapis.com/${encodeURIComponent(input.bucket)}/${encodedName(input.object)}?${canonicalQuery}&x-goog-signature=${signature}`;
}
