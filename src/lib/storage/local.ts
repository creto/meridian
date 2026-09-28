import { sha256Hex } from "./sigv4.ts";
import { requestId } from "./http.ts";
import type { ObjectStat, ObjectStorageProvider, PutInput, StorageError, StorageOutcome } from "./types.ts";

interface Stored {
  body: Uint8Array;
  stat: ObjectStat;
}

const memory = new Map<string, Stored>();
const DB = "meridian-objects";
const STORE = "blobs";

function idbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: Stored) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ body: Array.from(value.body), stat: value.stat }, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(key: string): Promise<Stored | undefined> {
  const db = await openDb();
  const raw = await new Promise<{ body: number[]; stat: ObjectStat } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as { body: number[]; stat: ObjectStat } | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!raw) return undefined;
  return { body: Uint8Array.from(raw.body), stat: raw.stat };
}

async function idbDelete(key: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbAll(): Promise<ObjectStat[]> {
  const db = await openDb();
  const rows = await new Promise<{ stat: ObjectStat }[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as { stat: ObjectStat }[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.map((row) => row.stat);
}

async function putStored(key: string, stored: Stored) {
  memory.set(key, stored);
  if (idbAvailable()) await idbPut(key, stored);
}

async function getStored(key: string): Promise<Stored | undefined> {
  const hit = memory.get(key);
  if (hit) return hit;
  if (!idbAvailable()) return undefined;
  const loaded = await idbGet(key);
  if (loaded) memory.set(key, loaded);
  return loaded;
}

export function createLocalProvider(): ObjectStorageProvider {
  return {
    kind: "local",
    async put(input: PutInput): Promise<StorageOutcome> {
      const sha256 = await sha256Hex(input.body);
      const stat: ObjectStat = {
        key: input.key,
        bytes: input.body.byteLength,
        sha256,
        contentType: input.contentType,
        lastModified: new Date().toISOString(),
      };
      await putStored(input.key, { body: input.body, stat });
      return { ok: true, key: input.key, bytes: stat.bytes, sha256, requestId: requestId() };
    },
    async get(key) {
      const stored = await getStored(key);
      if (!stored) return { ok: false, code: "NOT_FOUND", message: `No object at ${key}`, requestId: requestId() };
      return { ok: true, body: stored.body, stat: stored.stat, requestId: requestId() };
    },
    async delete(key) {
      memory.delete(key);
      if (idbAvailable()) await idbDelete(key);
      return { ok: true, requestId: requestId() };
    },
    async exists(key) {
      return (await getStored(key)) != null;
    },
    async stat(key) {
      const stored = await getStored(key);
      if (!stored) return { ok: false, code: "NOT_FOUND", message: `No object at ${key}`, requestId: requestId() };
      return { ok: true, stat: stored.stat, requestId: requestId() };
    },
    async list(prefix) {
      const fromMemory = [...memory.values()].map((item) => item.stat);
      const extra = idbAvailable() ? await idbAll() : [];
      const merged = new Map<string, ObjectStat>();
      for (const item of [...extra, ...fromMemory]) merged.set(item.key, item);
      const keys = [...merged.values()].filter((item) => item.key.startsWith(prefix));
      return { ok: true, keys, requestId: requestId() };
    },
    async signedDownloadUrl() {
      return { ok: false, code: "NOT_SUPPORTED", message: "The workspace archive does not mint signed URLs. Download the object from Archive.", requestId: requestId() };
    },
    async signedUploadUrl() {
      return { ok: false, code: "NOT_SUPPORTED", message: "The workspace archive does not mint signed upload URLs.", requestId: requestId() };
    },
  };
}

export async function saveLocalObject(key: string, body: Uint8Array, contentType: string) {
  return createLocalProvider().put({ key, body, contentType });
}

export async function readLocalObject(key: string) {
  return createLocalProvider().get(key);
}

export function isStorageError(value: { ok: boolean }): value is StorageError {
  return value.ok === false;
}
