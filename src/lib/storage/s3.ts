import { fetchRetry, missing, requestId } from "./http.ts";
import { encodePath, presignAws, sha256Hex, signAws } from "./sigv4.ts";
import type { ObjectStorageProvider, PutInput, StorageError, StorageOutcome } from "./types.ts";

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle?: boolean;
  prefix?: string;
}

function amzNow(date = new Date()): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function fail(message: string, code: string, status?: number): StorageError {
  return { ok: false, code, message, status, requestId: requestId() };
}

export function s3Target(config: S3Config, key: string): { url: string; host: string; path: string } {
  const cleaned = `${config.prefix ?? ""}${key}`.replace(/^\/+/, "");
  const pathKey = encodePath(cleaned);
  const endpoint = config.endpoint?.replace(/\/$/, "");
  const pathStyle = config.pathStyle === true || Boolean(endpoint && !endpoint.includes("amazonaws.com"));
  if (pathStyle) {
    const base = endpoint || `https://s3.${config.region}.amazonaws.com`;
    const host = new URL(base).host;
    const path = `/${encodePath(config.bucket)}/${pathKey}`;
    return { url: `${base}${path}`, host, path };
  }
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const path = `/${pathKey}`;
  return { url: `https://${host}${path}`, host, path };
}

async function signed(config: S3Config, method: string, key: string, body?: Uint8Array, contentType?: string) {
  if (!config.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) {
    return { error: missing("S3 bucket, region, access key, and secret are required") };
  }
  const target = s3Target(config, key);
  const payloadHash = await sha256Hex(body ?? new Uint8Array());
  const amzDate = amzNow();
  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = await signAws({
    method,
    host: target.host,
    path: target.path,
    headers,
    payloadHash,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    amzDate,
  });
  return {
    target,
    init: {
      method,
      headers: {
        ...headers,
        host: target.host,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        authorization: signedHeaders.authorization,
      },
      body: body ? (body as BufferSource) : undefined,
    } satisfies RequestInit,
  };
}

export function createS3Provider(config: S3Config): ObjectStorageProvider {
  return {
    kind: config.pathStyle ? "minio" : "s3",
    async put(input: PutInput): Promise<StorageOutcome> {
      if (input.body.byteLength > 8 * 1024 * 1024) return multipartPut(config, input);
      const signedReq = await signed(config, "PUT", input.key, input.body, input.contentType);
      if ("error" in signedReq && signedReq.error) return signedReq.error;
      if (!("target" in signedReq)) return fail("Could not sign the request", "SIGNING");
      const response = await fetchRetry(signedReq.target.url, signedReq.init);
      if (!response.ok) return fail(await snippet(response), "S3_PUT_FAILED", response.status);
      return {
        ok: true,
        key: input.key,
        bytes: input.body.byteLength,
        sha256: await sha256Hex(input.body),
        etag: response.headers.get("etag") ?? undefined,
        requestId: response.headers.get("x-amz-request-id") ?? requestId(),
      };
    },
    async get(key) {
      const signedReq = await signed(config, "GET", key);
      if ("error" in signedReq && signedReq.error) return signedReq.error;
      if (!("target" in signedReq)) return fail("Could not sign the request", "SIGNING");
      const response = await fetchRetry(signedReq.target.url, signedReq.init);
      if (!response.ok) return fail(await snippet(response), "S3_GET_FAILED", response.status);
      const body = new Uint8Array(await response.arrayBuffer());
      return {
        ok: true,
        body,
        stat: { key, bytes: body.byteLength, sha256: await sha256Hex(body), contentType: response.headers.get("content-type") ?? "application/octet-stream", etag: response.headers.get("etag") ?? undefined },
        requestId: response.headers.get("x-amz-request-id") ?? requestId(),
      };
    },
    async delete(key) {
      const signedReq = await signed(config, "DELETE", key);
      if ("error" in signedReq && signedReq.error) return signedReq.error;
      if (!("target" in signedReq)) return fail("Could not sign the request", "SIGNING");
      const response = await fetchRetry(signedReq.target.url, signedReq.init);
      if (!response.ok && response.status !== 204) return fail(await snippet(response), "S3_DELETE_FAILED", response.status);
      return { ok: true, requestId: response.headers.get("x-amz-request-id") ?? requestId() };
    },
    async exists(key) {
      const result = await this.stat(key);
      return result.ok;
    },
    async stat(key) {
      const signedReq = await signed(config, "HEAD", key);
      if ("error" in signedReq && signedReq.error) return signedReq.error;
      if (!("target" in signedReq)) return fail("Could not sign the request", "SIGNING");
      const response = await fetchRetry(signedReq.target.url, signedReq.init);
      if (!response.ok) return fail(await snippet(response), "S3_HEAD_FAILED", response.status);
      const len = Number(response.headers.get("content-length") ?? "0");
      return {
        ok: true,
        stat: { key, bytes: len, sha256: "", contentType: response.headers.get("content-type") ?? "application/octet-stream", etag: response.headers.get("etag") ?? undefined },
        requestId: response.headers.get("x-amz-request-id") ?? requestId(),
      };
    },
    async list(prefix) {
      const full = `${config.prefix ?? ""}${prefix}`.replace(/^\/+/, "");
      const target = s3Target({ ...config, prefix: "" }, "");
      const query = { "list-type": "2", prefix: full };
      const amzDate = amzNow();
      const path = target.path.endsWith("/") ? target.path.slice(0, -1) || "/" : target.path || "/";
      const signedHeaders = await signAws({
        method: "GET",
        host: target.host,
        path,
        query,
        payloadHash: await sha256Hex(""),
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: config.region,
        amzDate,
      });
      const qs = new URLSearchParams(query).toString();
      const response = await fetchRetry(`${target.url.split("?")[0]}?${qs}`, {
        headers: { host: target.host, "x-amz-date": amzDate, "x-amz-content-sha256": await sha256Hex(""), authorization: signedHeaders.authorization },
      });
      if (!response.ok) return fail(await snippet(response), "S3_LIST_FAILED", response.status);
      const xml = await response.text();
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => ({
        key: match[1] ?? "",
        bytes: 0,
        sha256: "",
        contentType: "application/octet-stream",
      }));
      return { ok: true, keys, requestId: response.headers.get("x-amz-request-id") ?? requestId() };
    },
    async signedDownloadUrl(key, expiresSeconds) {
      if (!config.accessKeyId || !config.secretAccessKey) return missing("Secret access key is not loaded");
      const target = s3Target(config, key);
      const url = await presignAws({
        method: "GET",
        host: target.host,
        path: target.path,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: config.region,
        amzDate: amzNow(),
        expires: expiresSeconds,
      });
      return { ok: true, url, requestId: requestId() };
    },
    async signedUploadUrl(key, expiresSeconds) {
      if (!config.accessKeyId || !config.secretAccessKey) return missing("Secret access key is not loaded");
      const target = s3Target(config, key);
      const url = await presignAws({
        method: "PUT",
        host: target.host,
        path: target.path,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: config.region,
        amzDate: amzNow(),
        expires: expiresSeconds,
      });
      return { ok: true, url, requestId: requestId() };
    },
  };
}

async function multipartPut(config: S3Config, input: PutInput): Promise<StorageOutcome> {
  const start = await signed(config, "POST", `${input.key}?uploads`);
  if (!("target" in start)) return fail("Could not start multipart upload", "S3_MULTIPART");
  const create = await fetchRetry(`${start.target!.url}?uploads`, start.init!);
  if (!create.ok) return fail(await snippet(create), "S3_MULTIPART", create.status);
  const xml = await create.text();
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) return fail("Multipart upload id missing from the S3 response", "S3_MULTIPART");
  const partSize = 5 * 1024 * 1024;
  const etags: string[] = [];
  for (let part = 1, offset = 0; offset < input.body.byteLength; part += 1, offset += partSize) {
    const slice = input.body.subarray(offset, offset + partSize);
    const req = await signed(config, "PUT", `${input.key}?partNumber=${part}&uploadId=${encodeURIComponent(uploadId)}`, slice, input.contentType);
    if (!("target" in req)) return fail("Could not sign a multipart part", "S3_MULTIPART");
    const response = await fetchRetry(req.target!.url, req.init!);
    if (!response.ok) return fail(await snippet(response), "S3_MULTIPART", response.status);
    etags.push(response.headers.get("etag") ?? "");
  }
  const bodyXml = `<CompleteMultipartUpload>${etags.map((etag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${etag}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
  const completeBody = new TextEncoder().encode(bodyXml);
  const done = await signed(config, "POST", `${input.key}?uploadId=${encodeURIComponent(uploadId)}`, completeBody, "application/xml");
  if (!("target" in done)) return fail("Could not complete multipart upload", "S3_MULTIPART");
  const response = await fetchRetry(`${done.target!.url}?uploadId=${encodeURIComponent(uploadId)}`, done.init!);
  if (!response.ok) return fail(await snippet(response), "S3_MULTIPART", response.status);
  return { ok: true, key: input.key, bytes: input.body.byteLength, sha256: await sha256Hex(input.body), requestId: response.headers.get("x-amz-request-id") ?? requestId() };
}

export async function testS3(config: S3Config): Promise<StorageError | { ok: true; message: string; requestId: string }> {
  const provider = createS3Provider(config);
  const key = `${config.prefix ?? ""}meridian-healthcheck.txt`.replace(/^\/+/, "");
  const body = new TextEncoder().encode(`meridian ${new Date().toISOString()}`);
  const put = await provider.put({ key, body, contentType: "text/plain" });
  if (!put.ok) return put;
  const got = await provider.get(key);
  if (!got.ok) return got;
  await provider.delete(key);
  return { ok: true, message: `Wrote and read ${key} (${put.bytes} bytes, sha256 ${put.sha256.slice(0, 12)})`, requestId: put.requestId };
}

async function snippet(response: Response): Promise<string> {
  const text = (await response.text()).slice(0, 400);
  return text || `S3 returned HTTP ${response.status}`;
}
