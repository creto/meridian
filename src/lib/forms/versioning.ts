import type { FormDefinition, FormVersion } from "./types.ts";

export type RestoreResult =
  | { ok: true; form: FormDefinition }
  | { ok: false; code: "NOT_FOUND"; message: string };

/**
 * Copy a historical version onto the working draft.
 * The versions array is not rewritten and no published row is mutated.
 */
export function restoreVersionAsDraft(form: FormDefinition, version: number, actor = "designer"): RestoreResult {
  const snapshot = form.versions.find((item) => item.version === version);
  if (!snapshot) return { ok: false, code: "NOT_FOUND", message: `Version ${version} does not exist` };
  const now = new Date().toISOString();
  const next: FormDefinition = {
    ...form,
    title: snapshot.title,
    display: snapshot.display,
    components: structuredClone(snapshot.components),
    workflow: snapshot.workflow ? structuredClone(snapshot.workflow) : undefined,
    status: form.status === "archived" ? "draft" : form.status,
    hasUnpublishedChanges: true,
    updatedAt: now,
    versions: form.versions.map((item) => ({ ...item, components: item.components, workflow: item.workflow })),
    activity: [{ at: now, actor, message: `Restored version ${version} into the working draft` }, ...form.activity].slice(0, 40),
  };
  return { ok: true, form: next };
}

export function versionDigest(version: FormVersion): string {
  return JSON.stringify({
    version: version.version,
    title: version.title,
    display: version.display,
    components: version.components,
    workflow: version.workflow ?? null,
  });
}

/** True when two published snapshots would rewrite history. */
export function samePublishedSnapshot(left: FormVersion, right: FormVersion): boolean {
  return versionDigest(left) === versionDigest(right);
}
