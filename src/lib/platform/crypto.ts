import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export function hashPassword(password: string, salt = randomBytes(16)): { hash: string; salt: string } {
  const derived = scryptSync(password, salt, 32);
  return { hash: derived.toString("base64"), salt: salt.toString("base64") };
}

export function passwordRecord(password: string): string {
  const { hash, salt } = hashPassword(password);
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, record: string): boolean {
  const [scheme, saltB64, hashB64] = record.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const derived = scryptSync(password, Buffer.from(saltB64, "base64"), 32);
  const expected = Buffer.from(hashB64, "base64");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** High-entropy API secrets are hashed with SHA-256. User passwords use Argon2id. */
export function hashApiSecret(secret: string): string {
  return sha256Text(secret);
}

export function encryptSecret(plaintext: string, masterKey: Buffer): { ciphertext: string; iv: string; authTag: string } {
  if (masterKey.length !== 32) throw new Error("Master key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(input: { ciphertext: string; iv: string; authTag: string }, masterKey: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(input.ciphertext, "base64")), decipher.final()]);
  return plain.toString("utf8");
}

export function auditHash(input: { seq: number; tenantId: string; actor: string; action: string; target: string; detail?: string; prevHash: string }): string {
  const canonical = JSON.stringify({
    action: input.action,
    actor: input.actor,
    detail: input.detail ?? "",
    prev: input.prevHash,
    seq: input.seq,
    target: input.target,
    tenant: input.tenantId,
  });
  return sha256Text(canonical);
}
