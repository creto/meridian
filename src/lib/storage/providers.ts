import { fetchRetry, missing, requestId } from "./http.ts";
import { sha256Hex } from "./sigv4.ts";
import { mintGcsAssertion, exchangeGcsAssertion } from "./gcs-jwt.ts";
import { blockedTarget } from "./ssrf.ts";
import type { ECMProvider, PutInput, StorageError, StorageOutcome } from "./types.ts";

function fail(message: string, code: string, status?: number): StorageError {
  return { ok: false, code, message, status, requestId: requestId() };
}

async function bodyText(response: Response): Promise<string> {
  return (await response.text()).slice(0, 500) || `HTTP ${response.status}`;
}

export interface AzureConfig {
  account: string;
  container: string;
  accountKey: string;
  prefix?: string;
}

function azureCanonical(method: string, account: string, container: string, key: string, contentType: string, date: string, length: number) {
  const resource = `/${account}/${container}/${key}`;
  return [method, "", "", String(length), "", contentType, "", "", "", "", "", "", `x-ms-date:${date}`, `x-ms-version:2021-08-06`, resource].join("\n");
}

async function azureAuth(config: AzureConfig, method: string, key: string, contentType: string, length: number, date: string) {
  const canonical = azureCanonical(method, config.account, config.container, key, contentType, date, length);
  const raw = Uint8Array.from(atob(config.accountKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(canonical));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `SharedKey ${config.account}:${signature}`;
}

export async function testAzure(config: AzureConfig): Promise<StorageError | { ok: true; message: string; requestId: string }> {
  if (!config.account || !config.container || !config.accountKey) return missing("Azure account, container, and account key are required");
  const key = `${config.prefix ?? ""}meridian-healthcheck.txt`.replace(/^\/+/, "");
  const body = new TextEncoder().encode("meridian");
  const date = new Date().toUTCString();
  const auth = await azureAuth(config, "PUT", key, "text/plain", body.byteLength, date);
  const url = `https://${config.account}.blob.core.windows.net/${config.container}/${key}`;
  const response = await fetchRetry(url, {
    method: "PUT",
    headers: {
      authorization: auth,
      "x-ms-date": date,
      "x-ms-version": "2021-08-06",
      "x-ms-blob-type": "BlockBlob",
      "content-type": "text/plain",
      "content-length": String(body.byteLength),
    },
    body,
  });
  if (!response.ok) return fail(await bodyText(response), "AZURE_PUT_FAILED", response.status);
  return { ok: true, message: `Uploaded ${key} to ${config.container}`, requestId: response.headers.get("x-ms-request-id") ?? requestId() };
}

export async function putAzure(config: AzureConfig, input: PutInput): Promise<StorageOutcome> {
  const tested = await testAzure({ ...config, prefix: "" });
  if (!tested.ok && tested.code === "NOT_CONFIGURED") return tested;
  const key = `${config.prefix ?? ""}${input.key}`.replace(/^\/+/, "");
  const date = new Date().toUTCString();
  const auth = await azureAuth(config, "PUT", key, input.contentType, input.body.byteLength, date);
  const url = `https://${config.account}.blob.core.windows.net/${config.container}/${key}`;
  const response = await fetchRetry(url, {
    method: "PUT",
    headers: {
      authorization: auth,
      "x-ms-date": date,
      "x-ms-version": "2021-08-06",
      "x-ms-blob-type": "BlockBlob",
      "content-type": input.contentType,
    },
    body: input.body as BufferSource,
  });
  if (!response.ok) return fail(await bodyText(response), "AZURE_PUT_FAILED", response.status);
  return { ok: true, key, bytes: input.body.byteLength, sha256: await sha256Hex(input.body), requestId: response.headers.get("x-ms-request-id") ?? requestId() };
}

export interface GcsConfig {
  bucket: string;
  accessToken?: string;
  clientEmail?: string;
  privateKey?: string;
  prefix?: string;
}

async function resolveGcsToken(config: GcsConfig): Promise<{ ok: true; token: string } | StorageError> {
  if (config.accessToken) return { ok: true, token: config.accessToken };
  if (!config.clientEmail || !config.privateKey) return missing("GCS needs a bearer token or a service-account email and private key");
  try {
    const assertion = await mintGcsAssertion(config.clientEmail, config.privateKey);
    const exchanged = await exchangeGcsAssertion(assertion);
    if (!exchanged.ok) return fail(exchanged.message, "GCS_AUTH", exchanged.status);
    return { ok: true, token: exchanged.token };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not mint a GCS assertion", "GCS_AUTH");
  }
}

export async function putGcs(config: GcsConfig, input: PutInput): Promise<StorageOutcome> {
  if (!config.bucket) return missing("GCS bucket is required");
  const token = await resolveGcsToken(config);
  if (!token.ok) return token;
  const name = `${config.prefix ?? ""}${input.key}`.replace(/^\/+/, "");
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(config.bucket)}/o?uploadType=media&name=${encodeURIComponent(name)}`;
  const response = await fetchRetry(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token.token}`, "content-type": input.contentType },
    body: input.body as BufferSource,
  });
  if (!response.ok) return fail(await bodyText(response), "GCS_PUT_FAILED", response.status);
  const json = (await response.json()) as { id?: string; mediaLink?: string };
  return { ok: true, key: name, bytes: input.body.byteLength, sha256: await sha256Hex(input.body), externalId: json.id, url: json.mediaLink, requestId: requestId() };
}

export async function getGcs(config: GcsConfig, key: string): Promise<{ ok: true; body: Uint8Array } | StorageError> {
  const token = await resolveGcsToken(config);
  if (!token.ok) return token;
  const name = `${config.prefix ?? ""}${key}`.replace(/^\/+/, "");
  const response = await fetchRetry(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(name)}?alt=media`, {
    headers: { authorization: `Bearer ${token.token}` },
  });
  if (!response.ok) return fail(await bodyText(response), "GCS_GET_FAILED", response.status);
  return { ok: true, body: new Uint8Array(await response.arrayBuffer()) };
}

export async function deleteGcs(config: GcsConfig, key: string): Promise<{ ok: true } | StorageError> {
  const token = await resolveGcsToken(config);
  if (!token.ok) return token;
  const name = `${config.prefix ?? ""}${key}`.replace(/^\/+/, "");
  const response = await fetchRetry(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token.token}` },
  });
  if (!response.ok && response.status !== 404) return fail(await bodyText(response), "GCS_DELETE_FAILED", response.status);
  return { ok: true };
}

export async function testGcs(config: GcsConfig) {
  const put = await putGcs(config, { key: "meridian-healthcheck.txt", body: new TextEncoder().encode("meridian"), contentType: "text/plain" });
  if (!put.ok) return put;
  const got = await getGcs(config, "meridian-healthcheck.txt");
  if (!got.ok) return got;
  const removed = await deleteGcs(config, "meridian-healthcheck.txt");
  if (!removed.ok) return removed;
  return { ok: true as const, message: "GCS put, get, and delete succeeded", requestId: put.requestId ?? requestId() };
}

export interface SharePointConfig {
  tenant: string;
  clientId: string;
  clientSecret: string;
  site: string;
  drive?: string;
  folder?: string;
}

async function graphToken(config: SharePointConfig): Promise<{ ok: true; token: string } | StorageError> {
  if (!config.tenant || !config.clientId || !config.clientSecret) return missing("SharePoint tenant, client id, and client secret are required");
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetchRetry(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) return fail(json.error_description || json.error || `Token endpoint returned HTTP ${response.status}`, "SHAREPOINT_AUTH", response.status);
  return { ok: true, token: json.access_token };
}

export async function testSharePoint(config: SharePointConfig): Promise<StorageError | { ok: true; message: string; requestId: string }> {
  const token = await graphToken(config);
  if (!token.ok) return token;
  if (!config.site) return missing("SharePoint site id or hostname:/sites/name is required");
  const sitePath = config.site.includes(":") ? config.site : `sites/${config.site}`;
  const response = await fetchRetry(`https://graph.microsoft.com/v1.0/${sitePath.startsWith("sites/") ? sitePath : `sites/${sitePath}`}`, {
    headers: { authorization: `Bearer ${token.token}` },
  });
  if (!response.ok) return fail(await bodyText(response), "SHAREPOINT_SITE", response.status);
  const json = (await response.json()) as { displayName?: string; id?: string };
  return { ok: true, message: `Connected to site ${json.displayName || json.id || config.site}`, requestId: requestId() };
}

export function createSharePoint(config: SharePointConfig): ECMProvider {
  return {
    kind: "sharepoint",
    testConnection: () => testSharePoint(config),
    async listFolders(path: string) {
      const token = await graphToken(config);
      if (!token.ok) return token;
      const url = `https://graph.microsoft.com/v1.0/sites/${config.site}/drives/${config.drive || "root"}/root:${encodeURI(path)}:/children`;
      const response = await fetchRetry(url, { headers: { authorization: `Bearer ${token.token}` } });
      if (!response.ok) return fail(await bodyText(response), "SHAREPOINT_LIST", response.status);
      const json = (await response.json()) as { value?: { id: string; name: string; folder?: unknown; webUrl?: string }[] };
      const folders = (json.value ?? []).filter((item) => item.folder).map((item) => ({ id: item.id, name: item.name, path: item.webUrl || item.name }));
      return { ok: true, folders, requestId: requestId() };
    },
    async createFolder(path: string) {
      const token = await graphToken(config);
      if (!token.ok) return token;
      const parent = path.split("/").slice(0, -1).join("/") || "/";
      const name = path.split("/").filter(Boolean).pop() || "folder";
      const url = `https://graph.microsoft.com/v1.0/sites/${config.site}/drives/${config.drive || "root"}/root:${encodeURI(parent)}:/children`;
      const response = await fetchRetry(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token.token}`, "content-type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
      });
      if (!response.ok) return fail(await bodyText(response), "SHAREPOINT_FOLDER", response.status);
      const json = (await response.json()) as { id: string };
      return { ok: true, id: json.id, path, requestId: requestId() };
    },
    async uploadDocument(input) {
      const token = await graphToken(config);
      if (!token.ok) return token;
      const folder = input.folder || config.folder || "";
      const path = `${folder}/${input.key}`.replace(/\/+/g, "/");
      const url = `https://graph.microsoft.com/v1.0/sites/${config.site}/drives/${config.drive || "root"}/root:${encodeURI(path)}:/content`;
      const response = await fetchRetry(url, {
        method: "PUT",
        headers: { authorization: `Bearer ${token.token}`, "content-type": input.contentType },
        body: input.body as BufferSource,
      });
      if (!response.ok) return fail(await bodyText(response), "SHAREPOINT_UPLOAD", response.status);
      const json = (await response.json()) as { id?: string; webUrl?: string; eTag?: string };
      return {
        ok: true,
        key: path,
        bytes: input.body.byteLength,
        sha256: await sha256Hex(input.body),
        externalId: json.id,
        url: json.webUrl,
        etag: json.eTag,
        requestId: requestId(),
      };
    },
    async downloadDocument(id: string) {
      const token = await graphToken(config);
      if (!token.ok) return token;
      const response = await fetchRetry(`https://graph.microsoft.com/v1.0/sites/${config.site}/drives/${config.drive || "root"}/items/${id}/content`, {
        headers: { authorization: `Bearer ${token.token}` },
      });
      if (!response.ok) return fail(await bodyText(response), "SHAREPOINT_DOWNLOAD", response.status);
      return { ok: true, body: new Uint8Array(await response.arrayBuffer()), requestId: requestId() };
    },
  };
}

export interface CmisConfig {
  browserUrl: string;
  repositoryId?: string;
  username?: string;
  password?: string;
  folder?: string;
}

function cmisHeaders(config: CmisConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.username) headers.authorization = `Basic ${btoa(`${config.username}:${config.password ?? ""}`)}`;
  return headers;
}

export async function testCmis(config: CmisConfig): Promise<StorageError | { ok: true; message: string; requestId: string }> {
  if (!config.browserUrl) return missing("CMIS browser binding URL is required");
  const response = await fetchRetry(config.browserUrl, { headers: cmisHeaders(config) });
  const text = await response.text();
  if (!response.ok) return fail(text.slice(0, 400) || `HTTP ${response.status}`, "CMIS_DISCOVERY", response.status);
  let message = "CMIS binding responded";
  try {
    const json = JSON.parse(text) as Record<string, { repositoryId?: string; repositoryName?: string }>;
    const first = Object.values(json)[0];
    if (first?.repositoryId) message = `Repository ${first.repositoryName || first.repositoryId}`;
  } catch {
    if (!/repository/i.test(text)) return fail("Response was not a CMIS repository listing", "CMIS_DISCOVERY", response.status);
  }
  return { ok: true, message, requestId: requestId() };
}

export function createCmis(config: CmisConfig): ECMProvider {
  const repo = () => `${config.browserUrl.replace(/\/$/, "")}/${config.repositoryId || "default"}`;
  return {
    kind: "cmis",
    testConnection: () => testCmis(config),
    async listFolders(path: string) {
      const response = await fetchRetry(`${repo()}/root?cmisselector=children&succinct=true`, { headers: cmisHeaders(config) });
      if (!response.ok) return fail(await bodyText(response), "CMIS_LIST", response.status);
      const json = (await response.json()) as { objects?: { object?: { succinctProperties?: Record<string, string> } }[] };
      const folders = (json.objects ?? [])
        .map((item) => item.object?.succinctProperties)
        .filter((props) => props && props["cmis:baseTypeId"] === "cmis:folder")
        .map((props) => ({ id: props!["cmis:objectId"] ?? "", name: props!["cmis:name"] ?? "", path: props!["cmis:path"] || path }));
      return { ok: true, folders, requestId: requestId() };
    },
    async createFolder(path: string) {
      const name = path.split("/").filter(Boolean).pop() || "folder";
      const body = new URLSearchParams({
        cmisaction: "createFolder",
        "propertyId[0]": "cmis:name",
        "propertyValue[0]": name,
        "propertyId[1]": "cmis:objectTypeId",
        "propertyValue[1]": "cmis:folder",
        succinct: "true",
      });
      const response = await fetchRetry(`${repo()}/root`, { method: "POST", headers: { ...cmisHeaders(config), "content-type": "application/x-www-form-urlencoded" }, body });
      if (!response.ok) return fail(await bodyText(response), "CMIS_FOLDER", response.status);
      const json = (await response.json().catch(() => ({}))) as { succinctProperties?: Record<string, string> };
      return { ok: true, id: json.succinctProperties?.["cmis:objectId"] || name, path, requestId: requestId() };
    },
    async uploadDocument(input) {
      const form = new FormData();
      form.set("cmisaction", "createDocument");
      form.set("propertyId[0]", "cmis:name");
      form.set("propertyValue[0]", input.key.split("/").pop() || input.key);
      form.set("propertyId[1]", "cmis:objectTypeId");
      form.set("propertyValue[1]", "cmis:document");
      form.set("succinct", "true");
      form.set("content", new Blob([input.body as BlobPart], { type: input.contentType }), input.key);
      const response = await fetchRetry(`${repo()}/root`, { method: "POST", headers: cmisHeaders(config), body: form });
      if (!response.ok) return fail(await bodyText(response), "CMIS_UPLOAD", response.status);
      const json = (await response.json().catch(() => ({}))) as { succinctProperties?: Record<string, string> };
      return {
        ok: true,
        key: input.key,
        bytes: input.body.byteLength,
        sha256: await sha256Hex(input.body),
        externalId: json.succinctProperties?.["cmis:objectId"],
        version: json.succinctProperties?.["cmis:versionLabel"],
        requestId: requestId(),
      };
    },
    async downloadDocument(id: string) {
      const response = await fetchRetry(`${repo()}/root?objectId=${encodeURIComponent(id)}&cmisselector=content`, { headers: cmisHeaders(config) });
      if (!response.ok) return fail(await bodyText(response), "CMIS_DOWNLOAD", response.status);
      return { ok: true, body: new Uint8Array(await response.arrayBuffer()), requestId: requestId() };
    },
  };
}

export interface RestConfig {
  endpoint: string;
  bearer?: string;
  prefix?: string;
  allowPrivate?: boolean;
}

export async function putRest(config: RestConfig, input: PutInput): Promise<StorageOutcome> {
  if (!config.endpoint) return missing("REST ECM endpoint is required");
  const blocked = blockedTarget(config.endpoint, config.allowPrivate === true);
  if (blocked) return missing(blocked, "SSRF_BLOCKED");
  const url = `${config.endpoint.replace(/\/$/, "")}/${`${config.prefix ?? ""}${input.key}`.replace(/^\/+/, "")}`;
  const headers: Record<string, string> = { "content-type": input.contentType };
  if (config.bearer) headers.authorization = `Bearer ${config.bearer}`;
  const response = await fetchRetry(url, { method: "PUT", headers, body: input.body as BufferSource });
  if (!response.ok) return fail(await bodyText(response), "REST_PUT_FAILED", response.status);
  return { ok: true, key: input.key, bytes: input.body.byteLength, sha256: await sha256Hex(input.body), url, requestId: requestId() };
}

export async function testRest(config: RestConfig) {
  return putRest(config, { key: "meridian-healthcheck.txt", body: new TextEncoder().encode("meridian"), contentType: "text/plain" });
}
