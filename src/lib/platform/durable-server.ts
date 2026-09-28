import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { getSql } from "../db.ts";
import type { WorkspaceSnapshot } from "./snapshot.ts";
import { readSnapshot, writeSnapshot } from "./snapshot.ts";
import { loadWorkspace, saveWorkspace, seedPlatform, workspaceHash, type WorkspacePayload } from "./durable.ts";

let booted: Promise<void> | null = null;

export function masterKey(): Buffer {
  const fromEnv = process.env.MERIDIAN_MASTER_KEY;
  if (fromEnv) {
    const key = fromEnv.length === 64 && /^[0-9a-f]+$/i.test(fromEnv) ? Buffer.from(fromEnv, "hex") : Buffer.from(fromEnv, "base64");
    if (key.length !== 32) throw new Error("MERIDIAN_MASTER_KEY must decode to 32 bytes");
    return key;
  }
  const path = join(process.cwd(), "data", "master.key");
  if (!existsSync(path)) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(path, randomBytes(32));
  }
  const key = readFileSync(path);
  if (key.length !== 32) throw new Error("data/master.key must be 32 bytes");
  return key;
}

export function bootPlatform(): Promise<void> {
  booted ??= (async () => {
    const sql = await getSql();
    await seedPlatform(sql, masterKey());
    const stored = await loadWorkspace(sql, "ten_northwind");
    if (stored && stored.forms.length > 0 && readSnapshot().revision === 0) {
      writeSnapshot({
        revision: stored.revision,
        forms: stored.forms as WorkspaceSnapshot["forms"],
        submissions: stored.submissions as WorkspaceSnapshot["submissions"],
        idempotency: stored.idempotency as WorkspaceSnapshot["idempotency"],
      });
    }
  })().catch((error) => {
    booted = null;
    throw error;
  });
  return booted;
}

export async function persistSnapshot(snap: WorkspaceSnapshot): Promise<void> {
  const sql = await getSql();
  const payload: WorkspacePayload = {
    revision: snap.revision,
    forms: snap.forms,
    submissions: snap.submissions,
    idempotency: snap.idempotency,
  };
  await saveWorkspace(sql, "ten_northwind", payload);
}

export function sameWorkspace(left: WorkspacePayload, right: WorkspacePayload): boolean {
  return workspaceHash(left) === workspaceHash(right);
}
