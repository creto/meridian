export function requestId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export async function fetchRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500 && response.status !== 429) return response;
      last = new Error(`HTTP ${response.status}`);
      if (i === attempts - 1) return response;
    } catch (error) {
      last = error;
      if (i === attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** i));
  }
  throw last instanceof Error ? last : new Error("Request failed");
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function interpolatePath(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*data\.([a-zA-Z0-9_.]+)\s*\}\}/g, (_all, path: string) => {
    const value = path.split(".").reduce<unknown>((cur, key) => {
      if (cur && typeof cur === "object") return (cur as Record<string, unknown>)[key];
      return undefined;
    }, data);
    return encodeURIComponent(value == null ? "" : String(value));
  });
}

export function missing(message: string, code = "NOT_CONFIGURED"): { ok: false; code: string; message: string; requestId: string } {
  return { ok: false, code, message, requestId: requestId() };
}
