import { createHash, randomUUID } from "node:crypto";

export interface EcmDocument {
  id: string;
  name: string;
  folder: string;
  sha256: string;
  bytes: number;
}

export interface ECMProvider {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  listFolders(parent: string): Promise<{ id: string; name: string }[]>;
  createFolder(parent: string, name: string): Promise<{ id: string }>;
  uploadDocument(input: { folder: string; name: string; body: Uint8Array; contentType?: string }): Promise<EcmDocument>;
  downloadDocument(id: string): Promise<Uint8Array>;
  updateDocument(id: string, body: Uint8Array): Promise<EcmDocument>;
  getMetadata(id: string): Promise<Record<string, string>>;
  setMetadata(id: string, meta: Record<string, string>): Promise<void>;
  search(query: string): Promise<EcmDocument[]>;
}

interface FolderRec {
  id: string;
  name: string;
  parentId: string | null;
}

interface DocRec {
  id: string;
  name: string;
  folderId: string;
  sha256: string;
  bytes: number;
  body: Uint8Array;
  contentType?: string;
  meta: Record<string, string>;
}

function digest(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function createMemoryEcm(): ECMProvider {
  const folders = new Map<string, FolderRec>();
  const docs = new Map<string, DocRec>();
  const root: FolderRec = { id: "root", name: "", parentId: null };
  folders.set(root.id, root);

  const childrenOf = (parentId: string) => [...folders.values()].filter((folder) => folder.parentId === parentId);

  const resolveFolder = (ref: string): FolderRec | undefined => {
    if (!ref || ref === "/" || ref === "root") return root;
    const direct = folders.get(ref);
    if (direct) return direct;
    const parts = ref.split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      const next = childrenOf(current.id).find((folder) => folder.name === part || folder.id === part);
      if (!next) return undefined;
      current = next;
    }
    return current;
  };

  const ensureFolder = (ref: string): FolderRec => {
    const existing = resolveFolder(ref);
    if (existing) return existing;
    const parts = ref.split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      let next = childrenOf(current.id).find((folder) => folder.name === part);
      if (!next) {
        next = { id: `fld_${randomUUID()}`, name: part, parentId: current.id };
        folders.set(next.id, next);
      }
      current = next;
    }
    return current;
  };

  const toDocument = (rec: DocRec): EcmDocument => ({
    id: rec.id,
    name: rec.name,
    folder: rec.folderId,
    sha256: rec.sha256,
    bytes: rec.bytes,
  });

  return {
    async testConnection() {
      return { ok: true, message: "Memory ECM is ready" };
    },

    async listFolders(parent) {
      const folder = resolveFolder(parent);
      if (!folder) return [];
      return childrenOf(folder.id).map((child) => ({ id: child.id, name: child.name }));
    },

    async createFolder(parent, name) {
      const folder = resolveFolder(parent);
      if (!folder) throw new Error("NOT_FOUND");
      const existing = childrenOf(folder.id).find((child) => child.name === name);
      if (existing) return { id: existing.id };
      const created: FolderRec = { id: `fld_${randomUUID()}`, name, parentId: folder.id };
      folders.set(created.id, created);
      return { id: created.id };
    },

    async uploadDocument(input) {
      const folder = ensureFolder(input.folder);
      const body = new Uint8Array(input.body);
      const rec: DocRec = {
        id: `doc_${randomUUID()}`,
        name: input.name,
        folderId: folder.id,
        sha256: digest(body),
        bytes: body.byteLength,
        body,
        meta: {},
      };
      if (input.contentType) rec.contentType = input.contentType;
      docs.set(rec.id, rec);
      return toDocument(rec);
    },

    async downloadDocument(id) {
      const rec = docs.get(id);
      if (!rec) throw new Error("NOT_FOUND");
      return new Uint8Array(rec.body);
    },

    async updateDocument(id, next) {
      const rec = docs.get(id);
      if (!rec) throw new Error("NOT_FOUND");
      const body = new Uint8Array(next);
      rec.body = body;
      rec.bytes = body.byteLength;
      rec.sha256 = digest(body);
      return toDocument(rec);
    },

    async getMetadata(id) {
      const rec = docs.get(id);
      if (!rec) throw new Error("NOT_FOUND");
      return { ...rec.meta };
    },

    async setMetadata(id, meta) {
      const rec = docs.get(id);
      if (!rec) throw new Error("NOT_FOUND");
      rec.meta = { ...rec.meta, ...meta };
    },

    async search(query) {
      const needle = query.trim().toLowerCase();
      return [...docs.values()].filter((rec) => rec.name.toLowerCase().includes(needle)).map(toDocument);
    },
  };
}
