export type Permission =
  | "form.create"
  | "form.read"
  | "form.edit"
  | "form.publish"
  | "form.delete"
  | "submission.create"
  | "submission.read"
  | "submission.edit"
  | "submission.delete"
  | "submission.export"
  | "workflow.manage"
  | "workflow.approve"
  | "integration.manage"
  | "storage.manage"
  | "api.manage"
  | "tenant.manage";

export type WorkspaceRole = "owner" | "designer" | "clerk" | "reviewer" | "agent" | "viewer";

const ALL: Permission[] = [
  "form.create",
  "form.read",
  "form.edit",
  "form.publish",
  "form.delete",
  "submission.create",
  "submission.read",
  "submission.edit",
  "submission.delete",
  "submission.export",
  "workflow.manage",
  "workflow.approve",
  "integration.manage",
  "storage.manage",
  "api.manage",
  "tenant.manage",
];

const GRANTS: Record<WorkspaceRole, Permission[]> = {
  owner: ALL,
  designer: ["form.create", "form.read", "form.edit", "form.publish", "form.delete", "submission.read", "submission.export", "workflow.manage", "api.manage"],
  clerk: ["form.read", "submission.create", "submission.read", "submission.edit", "submission.export"],
  reviewer: ["form.read", "submission.read", "workflow.approve"],
  agent: ["form.read", "submission.create", "submission.read"],
  viewer: ["form.read", "submission.read"],
};

export function can(role: WorkspaceRole | undefined, permission: Permission): boolean {
  const grants = GRANTS[role ?? "owner"] ?? [];
  return grants.includes(permission);
}

export function grantsFor(role: WorkspaceRole | undefined): Permission[] {
  return GRANTS[role ?? "owner"] ?? [];
}

export const ROLES: WorkspaceRole[] = ["owner", "designer", "clerk", "reviewer", "agent", "viewer"];
