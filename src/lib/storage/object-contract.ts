import { createHash } from "node:crypto";

export interface StoredObject {
  key: string;
  bytes: number;
  sha256: string;
  contentType?: string;
}

export interface ObjectStorageProvider {
  put(input: { key: string; body: Uint8Array; contentType?: string }): Promise<{ ok: true; object: StoredObject } | { ok: false; code: string; message: string }>;
  get(key: string): Promise<{ ok: true; body: Uint8Array; object: StoredObject } | { ok: false; code: string; message: string }>;
  delete(key: string): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  exists(key: string): Promise<boolean>;
  stat(key: string): Promise<StoredObject | null>;
  list(prefix: string): Promise<StoredObject[]>;
  testConnection(): Promise<{ ok: true; message: string } | { ok: false; code: string; message: string }>;
}

const HEALTH_KEY = "meridian-healthcheck.txt";

interface MemoryEntry {
  body: Uint8Array;
  object: StoredObject;
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function createMemoryStorage(): ObjectStorageProvider {
  const objects = new Map<string, MemoryEntry>();

  const provider: ObjectStorageProvider = {
    async put(input) {
      const body = new Uint8Array(input.body);
      const object: StoredObject = {
        key: input.key,
        bytes: body.byteLength,
        sha256: sha256(body),
      };
      if (input.contentType) object.contentType = input.contentType;
      objects.set(input.key, { body, object });
      return { ok: true, object: { ...object } };
    },

    async get(key) {
      const entry = objects.get(key);
      if (!entry) return { ok: false, code: "NOT_FOUND", message: `Object not found: ${key}` };
      return { ok: true, body: new Uint8Array(entry.body), object: { ...entry.object } };
    },

    async delete(key) {
      if (!objects.has(key)) return { ok: false, code: "NOT_FOUND", message: `Object not found: ${key}` };
      objects.delete(key);
      return { ok: true };
    },

    async exists(key) {
      return objects.has(key);
    },

    async stat(key) {
      const entry = objects.get(key);
      return entry ? { ...entry.object } : null;
    },

    async list(prefix) {
      const found: StoredObject[] = [];
      for (const entry of objects.values()) {
        if (entry.object.key.startsWith(prefix)) found.push({ ...entry.object });
      }
      found.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return found;
    },

    async testConnection() {
      const body = new TextEncoder().encode("meridian");
      const put = await provider.put({ key: HEALTH_KEY, body, contentType: "text/plain" });
      if (!put.ok) return { ok: false, code: put.code, message: put.message };
      const got = await provider.get(HEALTH_KEY);
      if (!got.ok) return { ok: false, code: got.code, message: got.message };
      const hash = sha256(body);
      const roundTrip = sameBytes(got.body, body) && got.object.sha256 === hash && got.object.sha256 === put.object.sha256 && got.object.key === HEALTH_KEY;
      const removed = await provider.delete(HEALTH_KEY);
      if (!roundTrip || !removed.ok) {
        return { ok: false, code: "HEALTHCHECK_MISMATCH", message: "Health check round trip mismatched" };
      }
      return { ok: true, message: "Memory storage round trip succeeded" };
    },
  };

  return provider;
}
