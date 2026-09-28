import { createHash } from "node:crypto";
import type { ECMProvider, EcmDocument } from "./ecm-contract.ts";
import { blockedDestination } from "../security/ssrf.ts";

export interface CmisBrowserOptions {
  browserUrl: string;
  repositoryId: string;
  username?: string;
  password?: string;
  fetchImpl?: typeof fetch;
  allowPrivate?: boolean;
}

interface Succinct {
  succinctProperties?: Record<string, string | number | boolean>;
}

function digest(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function prop(object: Succinct | undefined, name: string): string {
  const value = object?.succinctProperties?.[name];
  return value == null ? "" : String(value);
}

export function createCmisBrowser(options: CmisBrowserOptions): ECMProvider {
  const blocked = blockedDestination(options.browserUrl);
  if (blocked && !options.allowPrivate) throw new Error(blocked);
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = `${options.browserUrl.replace(/\/$/, "")}/${encodeURIComponent(options.repositoryId)}`;
  const headers = (): Record<string, string> => {
    if (!options.username) return {};
    return { authorization: `Basic ${Buffer.from(`${options.username}:${options.password ?? ""}`).toString("base64")}` };
  };

  async function get(query: string): Promise<Response> {
    return fetchImpl(`${root}?${query}`, { headers: headers() });
  }

  async function objectById(id: string): Promise<Succinct> {
    const response = await get(`objectId=${encodeURIComponent(id)}&cmisselector=object&succinct=true`);
    if (!response.ok) throw new Error(`CMIS object ${id} failed with HTTP ${response.status}`);
    return (await response.json()) as Succinct;
  }

  return {
    async testConnection() {
      const response = await fetchImpl(options.browserUrl, { headers: headers() });
      if (!response.ok) return { ok: false, message: `CMIS discovery failed with HTTP ${response.status}` };
      const json = (await response.json()) as Record<string, { repositoryName?: string; repositoryId?: string }>;
      const repo = json[options.repositoryId];
      if (!repo) return { ok: false, message: `Repository ${options.repositoryId} was not in the binding response` };
      return { ok: true, message: `Repository ${repo.repositoryName || repo.repositoryId}` };
    },
    async listFolders(parent) {
      const selector = parent && parent !== "/" ? `objectId=${encodeURIComponent(parent)}&cmisselector=children&succinct=true` : "cmisselector=children&succinct=true";
      const response = await get(selector);
      if (!response.ok) throw new Error(`CMIS children failed with HTTP ${response.status}`);
      const json = (await response.json()) as { objects?: { object?: Succinct }[] };
      return (json.objects ?? [])
        .map((item) => item.object)
        .filter((object) => prop(object, "cmis:baseTypeId") === "cmis:folder")
        .map((object) => ({ id: prop(object, "cmis:objectId"), name: prop(object, "cmis:name") }));
    },
    async createFolder(parent, name) {
      const body = new URLSearchParams({
        cmisaction: "createFolder",
        "propertyId[0]": "cmis:objectTypeId",
        "propertyValue[0]": "cmis:folder",
        "propertyId[1]": "cmis:name",
        "propertyValue[1]": name,
        succinct: "true",
      });
      if (parent && parent !== "/") body.set("objectId", parent);
      const response = await fetchImpl(`${root}`, { method: "POST", headers: { ...headers(), "content-type": "application/x-www-form-urlencoded" }, body });
      if (!response.ok) throw new Error(`CMIS createFolder failed with HTTP ${response.status}`);
      const json = (await response.json()) as Succinct;
      return { id: prop(json, "cmis:objectId") };
    },
    async uploadDocument(input) {
      const form = new FormData();
      form.set("cmisaction", "createDocument");
      form.set("propertyId[0]", "cmis:objectTypeId");
      form.set("propertyValue[0]", "cmis:document");
      form.set("propertyId[1]", "cmis:name");
      form.set("propertyValue[1]", input.name);
      form.set("succinct", "true");
      if (input.folder && input.folder !== "/") form.set("objectId", input.folder);
      form.set("content", new Blob([input.body as unknown as BlobPart], { type: input.contentType ?? "application/octet-stream" }), input.name);
      const response = await fetchImpl(root, { method: "POST", headers: headers(), body: form });
      if (!response.ok) throw new Error(`CMIS upload failed with HTTP ${response.status}`);
      const json = (await response.json()) as Succinct;
      return { id: prop(json, "cmis:objectId"), name: input.name, folder: input.folder, sha256: digest(input.body), bytes: input.body.byteLength };
    },
    async downloadDocument(id) {
      const response = await get(`objectId=${encodeURIComponent(id)}&cmisselector=content`);
      if (!response.ok) throw new Error(`CMIS download failed with HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    async updateDocument(id, body) {
      const form = new FormData();
      form.set("cmisaction", "setContent");
      form.set("objectId", id);
      form.set("overwriteFlag", "true");
      form.set("content", new Blob([body as unknown as BlobPart]), "content");
      const response = await fetchImpl(root, { method: "POST", headers: headers(), body: form });
      if (!response.ok) throw new Error(`CMIS setContent failed with HTTP ${response.status}`);
      const json = (await response.json()) as Succinct;
      return { id, name: prop(json, "cmis:name"), folder: prop(json, "cmis:path"), sha256: digest(body), bytes: body.byteLength };
    },
    async getMetadata(id) {
      const object = await objectById(id);
      const props = object.succinctProperties ?? {};
      return Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value)]));
    },
    async setMetadata(id, meta) {
      const body = new URLSearchParams({ cmisaction: "updateProperties", objectId: id, succinct: "true" });
      let index = 0;
      for (const [key, value] of Object.entries(meta)) {
        body.set(`propertyId[${index}]`, key);
        body.set(`propertyValue[${index}]`, value);
        index += 1;
      }
      const response = await fetchImpl(root, { method: "POST", headers: { ...headers(), "content-type": "application/x-www-form-urlencoded" }, body });
      if (!response.ok) throw new Error(`CMIS updateProperties failed with HTTP ${response.status}`);
    },
    async search(query) {
      const statement = `SELECT * FROM cmis:document WHERE CONTAINS('${query.replace(/'/g, "''")}')`;
      const response = await get(`cmisselector=query&q=${encodeURIComponent(statement)}&succinct=true`);
      if (!response.ok) throw new Error(`CMIS query failed with HTTP ${response.status}`);
      const json = (await response.json()) as { results?: { object?: Succinct }[] };
      return (json.results ?? []).map((item) => {
        const object = item.object;
        const doc: EcmDocument = {
          id: prop(object, "cmis:objectId"),
          name: prop(object, "cmis:name"),
          folder: prop(object, "cmis:path"),
          sha256: "",
          bytes: Number(object?.succinctProperties?.["cmis:contentStreamLength"] ?? 0),
        };
        return doc;
      });
    },
  };
}
