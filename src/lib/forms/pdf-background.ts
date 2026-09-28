const memory = new Map<string, { name: string; bytes: Uint8Array }>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("meridian-pdf", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("backgrounds")) database.createObjectStore("backgrounds");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the PDF store"));
  });
}

export async function savePdfBackground(formId: string, name: string, bytes: Uint8Array): Promise<void> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  memory.set(formId, { name, bytes: copy });
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("backgrounds", "readwrite");
      tx.objectStore("backgrounds").put({ name, bytes: copy }, formId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not store the PDF"));
    });
    db.close();
  } catch {
    // The in-memory copy still drives this session.
  }
}

export async function loadPdfBackground(formId: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  const cached = memory.get(formId);
  if (cached) return cached;
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const stored = await new Promise<{ name: string; bytes: Uint8Array } | null>((resolve, reject) => {
      const tx = db.transaction("backgrounds", "readonly");
      const request = tx.objectStore("backgrounds").get(formId);
      request.onsuccess = () => {
        const value = request.result as { name?: string; bytes?: Uint8Array } | undefined;
        if (!value?.bytes) resolve(null);
        else resolve({ name: value.name || "template.pdf", bytes: value.bytes });
      };
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (stored) memory.set(formId, stored);
    return stored;
  } catch {
    return null;
  }
}

export async function clearPdfBackground(formId: string): Promise<void> {
  memory.delete(formId);
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("backgrounds", "readwrite");
      tx.objectStore("backgrounds").delete(formId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Already gone from memory.
  }
}
