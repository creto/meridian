import { randomBytes } from "node:crypto";
import { withTransaction } from "../db.ts";
import type { WorkspaceSnapshot } from "./snapshot.ts";
import { readSnapshot, writeSnapshot } from "./snapshot.ts";
import { loadWorkspace, saveWorkspace, seedPlatform, workspaceHash, type WorkspacePayload } from "./durable.ts";
import { loadTenantWorkspace, replaceTenantWorkspace, WORKSPACE_TENANT } from "../domain/workspace-store.ts";
import { assertProductionPosture } from "../security/posture.ts";
import { startJobPump } from "../jobs/worker-loop.ts";

let booted: Promise<void> | null = null;

const memoryKey = globalThis as typeof globalThis & { __meridianMasterKey__?: Buffer };

export function masterKey(): Buffer {
  const fromEnv = process.env.MERIDIAN_MASTER_KEY;
  if (fromEnv) {
    const key = fromEnv.length === 64 && /^[0-9a-f]+$/i.test(fromEnv) ? Buffer.from(fromEnv, "hex") : Buffer.from(fromEnv, "base64");
    if (key.length !== 32) throw new Error("MERIDIAN_MASTER_KEY must decode to 32 bytes");
    return key;
  }
  if (process.env.DATABASE_URL?.trim() || process.env.MERIDIAN_ENV === "production") {
    throw new Error("MERIDIAN_MASTER_KEY is required");
  }
  memoryKey.__meridianMasterKey__ ??= randomBytes(32);
  return memoryKey.__meridianMasterKey__;
}

export function bootPlatform(): Promise<void> {
  booted ??= (async () => {
    assertProductionPosture();
    await withTransaction(async (sql) => {
      await seedPlatform(sql, masterKey());
      const relational = await loadTenantWorkspace(sql, WORKSPACE_TENANT);
      const stored = relational ?? (await loadWorkspace(sql, WORKSPACE_TENANT));
      if (stored && stored.forms.length > 0 && readSnapshot().revision === 0) {
        writeSnapshot({
          revision: stored.revision,
          forms: stored.forms as WorkspaceSnapshot["forms"],
          submissions: stored.submissions as WorkspaceSnapshot["submissions"],
          idempotency: stored.idempotency as WorkspaceSnapshot["idempotency"],
        });
      }
      if (stored && stored.forms.length > 0 && !relational) {
        await replaceTenantWorkspace(sql, WORKSPACE_TENANT, stored);
      }
    });
    startJobPump();
  })().catch((error) => {
    booted = null;
    throw error;
  });
  return booted;
}

export async function persistSnapshot(snap: WorkspaceSnapshot): Promise<void> {
  const payload: WorkspacePayload = {
    revision: snap.revision,
    forms: snap.forms,
    submissions: snap.submissions,
    idempotency: snap.idempotency,
  };
  await withTransaction(async (sql) => {
    await saveWorkspace(sql, WORKSPACE_TENANT, payload);
    await replaceTenantWorkspace(sql, WORKSPACE_TENANT, payload);
  });
}

export function sameWorkspace(left: WorkspacePayload, right: WorkspacePayload): boolean {
  return workspaceHash(left) === workspaceHash(right);
}
