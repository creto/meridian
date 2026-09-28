import { createHmac, createHash } from "node:crypto";
import type { ObjectStorageProvider, StoredObject } from "./object-contract.ts";

export interface AzureBlobOptions {
  account: string;
  container: string;
  accountKey: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const HEALTH_KEY = "meridian-healthcheck.txt";

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function rfc1123(date: Date): string {
  return date.toUTCString();
}

function encodeBlob(key: string): string {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

/** Shared Key authorization for the Blob service. The string-to-sign follows the 2009-09-19 layout. */
export function azureAuthorization(input: {
  method: string;
  account: string;
  container: string;
  key: string;
  accountKey: string;
  contentType?: string;
  contentLength?: number;
  date: string;
  extra?: Record<string, string>;
}): string {
  const canonical = Object.entries(input.extra ?? {})
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .filter(([name]) => name.startsWith("x-ms-"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join("\n");
  const resource = `/${input.account}/${input.container}/${input.key}`.replace(/\/+$/, "");
  const stringToSign = [
    input.method,
    "",
    "",
    input.contentLength ? String(input.contentLength) : "",
    "",
    input.contentType ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    canonical,
    resource,
  ].join("\n");
  const signature = createHmac("sha256", Buffer.from(input.accountKey, "base64")).update(stringToSign, "utf8").digest("base64");
  return `SharedKey ${input.account}:${signature}`;
}

function namesFromXml(xml: string): { name: string; size: number; sha256: string; contentType?: string }[] {
  const blocks = xml.split("<Blob>").slice(1);
  return blocks.map((block) => {
    const name = /<Name>([^<]*)<\/Name>/.exec(block)?.[1] ?? "";
    const size = Number(/<Content-Length>(\d+)<\/Content-Length>/.exec(block)?.[1] ?? 0);
    const sha = /<Sha256>([^<]*)<\/Sha256>/.exec(block)?.[1] ?? "";
    const contentType = /<Content-Type>([^<]*)<\/Content-Type>/.exec(block)?.[1];
    return { name, size, sha256: sha, contentType };
  }).filter((item) => item.name);
}

export function createAzureBlobProvider(options: AzureBlobOptions): ObjectStorageProvider {
  if (!options.account || !options.container || !options.accountKey) throw new Error("Azure account, container, and key are required");
  const fetchImpl = options.fetchImpl ?? fetch;
  const clock = options.now ?? (() => new Date());
  const base = `https://${options.account}.blob.core.windows.net/${options.container}`;

  async function request(method: string, key: string, init?: { body?: Uint8Array; contentType?: string; query?: string; metaSha?: string }): Promise<Response> {
    const date = rfc1123(clock());
    const extra: Record<string, string> = { "x-ms-date": date, "x-ms-version": "2021-08-06" };
    if (init?.metaSha) extra["x-ms-meta-sha256"] = init.metaSha;
    const headers: Record<string, string> = { ...extra, authorization: azureAuthorization({
      method,
      account: options.account,
      container: options.container,
      key,
      accountKey: options.accountKey,
      contentType: init?.contentType,
      contentLength: init?.body?.byteLength,
      date,
      extra,
    }) };
    if (init?.contentType) headers["content-type"] = init.contentType;
    if (init?.body) headers["content-length"] = String(init.body.byteLength);
    return fetchImpl(`${base}/${encodeBlob(key)}${init?.query ?? ""}`, { method, headers, body: init?.body ? (init.body as unknown as BodyInit) : undefined });
  }

  function asObject(key: string, bytes: number, hash: string, contentType?: string): StoredObject {
    const object: StoredObject = { key, bytes, sha256: hash };
    if (contentType) object.contentType = contentType;
    return object;
  }

  const provider: ObjectStorageProvider = {
    async put(input) {
      const hash = sha256(input.body);
      const response = await request("PUT", input.key, { body: input.body, contentType: input.contentType ?? "application/octet-stream", metaSha: hash });
      if (!response.ok) return { ok: false, code: "AZURE_PUT_FAILED", message: (await response.text()).slice(0, 300) || `HTTP ${response.status}` };
      return { ok: true, object: asObject(input.key, input.body.byteLength, hash, input.contentType) };
    },
    async get(key) {
      const response = await request("GET", key);
      if (response.status === 404) return { ok: false, code: "NOT_FOUND", message: `Object not found: ${key}` };
      if (!response.ok) return { ok: false, code: "AZURE_GET_FAILED", message: `HTTP ${response.status}` };
      const body = new Uint8Array(await response.arrayBuffer());
      const hash = response.headers.get("x-ms-meta-sha256") || sha256(body);
      return { ok: true, body, object: asObject(key, body.byteLength, hash, response.headers.get("content-type") ?? undefined) };
    },
    async delete(key) {
      const response = await request("DELETE", key);
      if (response.status === 404) return { ok: false, code: "NOT_FOUND", message: `Object not found: ${key}` };
      if (!response.ok) return { ok: false, code: "AZURE_DELETE_FAILED", message: `HTTP ${response.status}` };
      return { ok: true };
    },
    async exists(key) {
      const response = await request("HEAD", key);
      return response.ok;
    },
    async stat(key) {
      const response = await request("HEAD", key);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Azure stat failed with HTTP ${response.status}`);
      const bytes = Number(response.headers.get("content-length") ?? 0);
      return asObject(key, bytes, response.headers.get("x-ms-meta-sha256") ?? "", response.headers.get("content-type") ?? undefined);
    },
    async list(prefix) {
      const response = await request("GET", "", { query: `?restype=container&comp=list&prefix=${encodeURIComponent(prefix)}` });
      if (!response.ok) throw new Error(`Azure list failed with HTTP ${response.status}`);
      const xml = await response.text();
      return namesFromXml(xml).filter((item) => item.name.startsWith(prefix)).map((item) => asObject(item.name, item.size, item.sha256, item.contentType));
    },
    async testConnection() {
      const body = new TextEncoder().encode("meridian");
      const put = await provider.put({ key: HEALTH_KEY, body, contentType: "text/plain" });
      if (!put.ok) return put;
      const got = await provider.get(HEALTH_KEY);
      if (!got.ok) return got;
      const removed = await provider.delete(HEALTH_KEY);
      if (!removed.ok || got.body.byteLength !== body.byteLength) return { ok: false, code: "HEALTHCHECK_MISMATCH", message: "Azure health check did not round-trip" };
      return { ok: true, message: "Azure put, get, and delete succeeded" };
    },
  };
  return provider;
}
