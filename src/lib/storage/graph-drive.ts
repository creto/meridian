import { createHash } from "node:crypto";
import type { ECMProvider, EcmDocument } from "./ecm-contract.ts";

export interface GraphDriveOptions {
  tenant: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  driveId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface GraphItem {
  id: string;
  name: string;
  size?: number;
  folder?: unknown;
  file?: { mimeType?: string };
  webUrl?: string;
  eTag?: string;
  parentReference?: { path?: string };
  listItem?: { fields?: Record<string, string> };
}

const SMALL_UPLOAD = 4 * 1024 * 1024;

function digest(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function itemToDoc(item: GraphItem, folder: string): EcmDocument {
  return { id: item.id, name: item.name, folder, sha256: "", bytes: item.size ?? 0 };
}

export function createGraphDrive(options: GraphDriveOptions): ECMProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const clock = options.now ?? (() => Date.now());
  let token = "";
  let tokenUntil = 0;

  async function accessToken(): Promise<string> {
    if (token && clock() < tokenUntil) return token;
    const body = new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const response = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(options.tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error(`Graph token request failed with HTTP ${response.status}`);
    const json = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("Graph token response did not include an access token");
    token = json.access_token;
    tokenUntil = clock() + Math.max(30, (json.expires_in ?? 3600) - 60) * 1000;
    return token;
  }

  async function graph(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await accessToken()}`);
    let response = await fetchImpl(url, { ...init, headers });
    if (response.status === 401) {
      token = "";
      headers.set("authorization", `Bearer ${await accessToken()}`);
      response = await fetchImpl(url, { ...init, headers });
    }
    return response;
  }

  const drive = `https://graph.microsoft.com/v1.0/sites/${options.siteId}/drives/${options.driveId}`;

  async function itemByPath(path: string): Promise<GraphItem | null> {
    const response = await graph(`${drive}/root:${encodeURI(path)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Graph item lookup failed with HTTP ${response.status}`);
    return (await response.json()) as GraphItem;
  }

  return {
    async testConnection() {
      const response = await graph(`${drive}`);
      if (!response.ok) return { ok: false, message: `Graph drive lookup failed with HTTP ${response.status}` };
      const json = (await response.json()) as { name?: string };
      return { ok: true, message: `Connected to drive ${json.name || options.driveId}` };
    },
    async listFolders(parent) {
      const path = parent && parent !== "/" ? `${drive}/root:${encodeURI(parent)}:/children` : `${drive}/root/children`;
      const response = await graph(path);
      if (!response.ok) throw new Error(`Graph folder list failed with HTTP ${response.status}`);
      const json = (await response.json()) as { value?: GraphItem[] };
      return (json.value ?? []).filter((item) => item.folder).map((item) => ({ id: item.id, name: item.name }));
    },
    async createFolder(parent, name) {
      const url = parent && parent !== "/" ? `${drive}/root:${encodeURI(parent)}:/children` : `${drive}/root/children`;
      const response = await graph(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
      });
      if (!response.ok) throw new Error(`Graph folder create failed with HTTP ${response.status}`);
      const json = (await response.json()) as GraphItem;
      return { id: json.id };
    },
    async uploadDocument(input) {
      const path = `${input.folder.replace(/\/$/, "")}/${input.name}`.replace(/\/+/g, "/");
      if (input.body.byteLength <= SMALL_UPLOAD) {
        const response = await graph(`${drive}/root:${encodeURI(path)}:/content`, {
          method: "PUT",
          headers: { "content-type": input.contentType ?? "application/octet-stream" },
          body: input.body as unknown as BodyInit,
        });
        if (!response.ok) throw new Error(`Graph upload failed with HTTP ${response.status}`);
        const json = (await response.json()) as GraphItem;
        return { id: json.id, name: json.name, folder: input.folder, sha256: digest(input.body), bytes: input.body.byteLength };
      }
      const session = await graph(`${drive}/root:${encodeURI(path)}:/createUploadSession`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace", name: input.name } }),
      });
      if (!session.ok) throw new Error(`Graph upload session failed with HTTP ${session.status}`);
      const created = (await session.json()) as { uploadUrl?: string };
      if (!created.uploadUrl) throw new Error("Graph upload session did not return an upload URL");
      const chunk = 5 * 1024 * 1024;
      let uploaded: GraphItem | null = null;
      for (let start = 0; start < input.body.byteLength; start += chunk) {
        const end = Math.min(input.body.byteLength, start + chunk);
        const slice = input.body.subarray(start, end);
        const response = await fetchImpl(created.uploadUrl, {
          method: "PUT",
          headers: {
            "content-length": String(slice.byteLength),
            "content-range": `bytes ${start}-${end - 1}/${input.body.byteLength}`,
          },
          body: slice as unknown as BodyInit,
        });
        if (!response.ok && response.status !== 202) throw new Error(`Graph chunk upload failed with HTTP ${response.status}`);
        if (response.status === 201 || response.status === 200) uploaded = (await response.json()) as GraphItem;
      }
      if (!uploaded) throw new Error("Graph upload session finished without an item");
      return { id: uploaded.id, name: uploaded.name || input.name, folder: input.folder, sha256: digest(input.body), bytes: input.body.byteLength };
    },
    async downloadDocument(id) {
      const response = await graph(`${drive}/items/${encodeURIComponent(id)}/content`);
      if (!response.ok) throw new Error(`Graph download failed with HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    async updateDocument(id, body) {
      const response = await graph(`${drive}/items/${encodeURIComponent(id)}/content`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: body as unknown as BodyInit,
      });
      if (!response.ok) throw new Error(`Graph update failed with HTTP ${response.status}`);
      const json = (await response.json()) as GraphItem;
      return { id: json.id, name: json.name, folder: "", sha256: digest(body), bytes: body.byteLength };
    },
    async getMetadata(id) {
      const response = await graph(`${drive}/items/${encodeURIComponent(id)}?$expand=listItem`);
      if (!response.ok) throw new Error(`Graph metadata read failed with HTTP ${response.status}`);
      const json = (await response.json()) as GraphItem;
      const fields = json.listItem?.fields ?? {};
      return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)]));
    },
    async setMetadata(id, meta) {
      const response = await graph(`${drive}/items/${encodeURIComponent(id)}/listItem/fields`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(meta),
      });
      if (!response.ok) throw new Error(`Graph metadata write failed with HTTP ${response.status}`);
    },
    async search(query) {
      const response = await graph(`${drive}/root/search(q='${encodeURIComponent(query)}')`);
      if (!response.ok) throw new Error(`Graph search failed with HTTP ${response.status}`);
      const json = (await response.json()) as { value?: GraphItem[] };
      return (json.value ?? []).filter((item) => item.file).map((item) => itemToDoc(item, item.parentReference?.path ?? ""));
    },
  };
}
