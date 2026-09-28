import { decryptSecret, encryptSecret } from "../platform/crypto.ts";

export type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PII" | "financial" | "health" | "credentials" | "identifier";

const SEALED = new Set<DataClass>(["RESTRICTED", "PII", "financial", "health", "credentials", "identifier"]);

export interface SealedValue {
  v: 1;
  alg: "aes-256-gcm";
  keyVersion: number;
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function mustSeal(classification: DataClass | undefined): boolean {
  return classification != null && SEALED.has(classification);
}

export function sealValue(value: unknown, masterKey: Buffer, keyVersion = 1): SealedValue {
  const sealed = encryptSecret(JSON.stringify(value), masterKey);
  return { v: 1, alg: "aes-256-gcm", keyVersion, ciphertext: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag };
}

export function openValue(sealed: SealedValue, masterKey: Buffer): unknown {
  const text = decryptSecret({ ciphertext: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag }, masterKey);
  return JSON.parse(text) as unknown;
}

export function isSealed(value: unknown): value is SealedValue {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SealedValue>;
  return row.v === 1 && row.alg === "aes-256-gcm" && typeof row.ciphertext === "string" && typeof row.iv === "string" && typeof row.authTag === "string";
}

/** Mask for a viewer who may see the row but not the raw value. */
export function maskValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (text.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, text.length - 2))}${text.slice(-2)}`;
}
