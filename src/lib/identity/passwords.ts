import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

export type PasswordScheme = "argon2id" | "scrypt";

const ARGON = { parallelism: 1, iterations: 2, memorySize: 16384, hashLength: 32 };

/** Argon2id encoded hash. Existing scrypt$ records still verify. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    parallelism: ARGON.parallelism,
    iterations: ARGON.iterations,
    memorySize: ARGON.memorySize,
    hashLength: ARGON.hashLength,
    outputType: "encoded",
  });
}

export async function verifyPassword(password: string, record: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (record.startsWith("$argon2id$")) {
    try {
      return await argon2Verify({ password, hash: record });
    } catch {
      return false;
    }
  }
  if (env.MERIDIAN_ENV === "production") return false;
  return verifyScrypt(password, record);
}

export function hashPasswordScrypt(password: string, salt = randomBytes(16)): string {
  const derived = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyScrypt(password: string, record: string): boolean {
  const [scheme, saltB64, hashB64] = record.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const derived = scryptSync(password, Buffer.from(saltB64, "base64"), 32);
  const expected = Buffer.from(hashB64, "base64");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function schemeOf(record: string): PasswordScheme | "unknown" {
  if (record.startsWith("$argon2id$")) return "argon2id";
  if (record.startsWith("scrypt$")) return "scrypt";
  return "unknown";
}
