import { can, grantsFor, type Permission, type WorkspaceRole } from "../platform/rbac.ts";

/** Actions enforced on the server. The screen hiding a button is not authorization. */
export type Action =
  | "tenant.read"
  | "tenant.manage"
  | "workspace.create"
  | "workspace.read"
  | "workspace.update"
  | "workspace.delete"
  | "workspace.members.manage"
  | "form.create"
  | "form.read"
  | "form.update"
  | "form.delete"
  | "form.publish"
  | "form.archive"
  | "form.version.read"
  | "form.version.restore"
  | "submission.create"
  | "submission.read"
  | "submission.update"
  | "submission.delete"
  | "submission.export"
  | "workflow.read"
  | "workflow.manage"
  | "workflow.execute"
  | "workflow.task.claim"
  | "workflow.task.complete"
  | "workflow.approve"
  | "pdf.read"
  | "pdf.manage"
  | "pdf.generate"
  | "storage.read"
  | "storage.manage"
  | "integration.read"
  | "integration.manage"
  | "webhook.read"
  | "webhook.manage"
  | "agent.execute"
  | "api_client.read"
  | "api_client.manage"
  | "audit.read"
  | "admin";

export interface Actor {
  tenantId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface Resource {
  tenantId: string;
  type: string;
  id?: string;
}

export interface Decision {
  allow: boolean;
  action: Action;
  reason: "allowed" | "unknown-action" | "wrong-tenant" | "role-denied";
}

const LEGACY: Partial<Record<Action, Permission>> = {
  "form.create": "form.create",
  "form.read": "form.read",
  "form.update": "form.edit",
  "form.delete": "form.delete",
  "form.publish": "form.publish",
  "form.archive": "form.delete",
  "form.version.read": "form.read",
  "form.version.restore": "form.edit",
  "submission.create": "submission.create",
  "submission.read": "submission.read",
  "submission.update": "submission.edit",
  "submission.delete": "submission.delete",
  "submission.export": "submission.export",
  "workflow.manage": "workflow.manage",
  "workflow.approve": "workflow.approve",
  "workflow.task.complete": "workflow.approve",
  "workflow.task.claim": "workflow.approve",
  "workflow.execute": "workflow.approve",
  "workflow.read": "submission.read",
  "integration.manage": "integration.manage",
  "integration.read": "integration.manage",
  "storage.manage": "storage.manage",
  "storage.read": "storage.manage",
  "webhook.manage": "integration.manage",
  "webhook.read": "integration.manage",
  "api_client.manage": "api.manage",
  "api_client.read": "api.manage",
  "tenant.manage": "tenant.manage",
  "tenant.read": "tenant.manage",
  admin: "tenant.manage",
};

const ROLE_EXTRA: Record<WorkspaceRole, Action[]> = {
  owner: [],
  designer: ["form.version.read", "form.version.restore", "pdf.read", "pdf.manage", "workspace.read", "agent.execute"],
  clerk: ["pdf.generate", "pdf.read", "workspace.read"],
  reviewer: ["workflow.read", "workflow.task.claim", "workflow.task.complete", "pdf.read"],
  agent: ["agent.execute", "form.read", "submission.create", "submission.read"],
  viewer: ["form.read", "submission.read", "pdf.read", "workflow.read", "audit.read"],
};

export function authorize(input: { actor: Actor; action: Action; resource: Resource }): Decision {
  if (input.actor.tenantId !== input.resource.tenantId) {
    return { allow: false, action: input.action, reason: "wrong-tenant" };
  }
  if (input.actor.role === "owner") return { allow: true, action: input.action, reason: "allowed" };
  if (ROLE_EXTRA[input.actor.role]?.includes(input.action)) {
    return { allow: true, action: input.action, reason: "allowed" };
  }
  const legacy = LEGACY[input.action];
  if (!legacy) return { allow: false, action: input.action, reason: "unknown-action" };
  if (!can(input.actor.role, legacy)) return { allow: false, action: input.action, reason: "role-denied" };
  return { allow: true, action: input.action, reason: "allowed" };
}

export function explainRole(role: WorkspaceRole): { legacy: Permission[]; actions: Action[] } {
  const actions = (Object.keys(LEGACY) as Action[]).filter((action) => {
    const legacy = LEGACY[action];
    return legacy ? can(role, legacy) : false;
  });
  for (const extra of ROLE_EXTRA[role] ?? []) if (!actions.includes(extra)) actions.push(extra);
  if (role === "owner") return { legacy: grantsFor(role), actions: Object.keys(LEGACY) as Action[] };
  return { legacy: grantsFor(role), actions };
}
