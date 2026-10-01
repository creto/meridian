import { WORKSPACE_TENANT } from "../domain/workspace-store.ts";

/** The in-memory snapshot is the preview workspace only. Another tenant must not read it. */
export function ownsPreviewSnapshot(tenantId: string): boolean {
  return tenantId === WORKSPACE_TENANT;
}
