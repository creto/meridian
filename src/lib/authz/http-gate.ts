import { WORKSPACE_TENANT } from "../domain/workspace-store.ts";
import { authenticatePresentedKey } from "../platform/api-keys.ts";
import type { WorkspaceRole } from "../platform/rbac.ts";
import { applySecurityHeaders } from "../security/http.ts";
import { authorize, type Action, type Actor } from "./authorize.ts";

const ROLES: WorkspaceRole[] = ["owner", "designer", "clerk", "reviewer", "agent", "viewer"];

export function authRequired(): boolean {
  return process.env.MERIDIAN_REQUIRE_AUTH === "1" || process.env.MERIDIAN_ENV === "production";
}

export interface GateOk {
  ok: true;
  actor: Actor;
  authenticated: boolean;
}

export interface GateNo {
  ok: false;
  response: Response;
}

function json(body: unknown, status: number): Response {
  return applySecurityHeaders(Response.json(body, { status }));
}

/** Resolve the caller and enforce one action. A preview without a key is the northwind owner. Production without a key is rejected. */
export async function guard(request: Request, action: Action, resource: { tenantId?: string; type: string; id?: string }): Promise<GateOk | GateNo> {
  const bearer = request.headers.get("authorization");
  let actor: Actor;
  let authenticated = false;
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    const { getSql } = await import("../db.ts");
    const sql = await getSql();
    const auth = await authenticatePresentedKey(sql, bearer.slice(7).trim());
    if (!auth) return { ok: false, response: json({ error: { code: "UNAUTHORIZED", message: "API key was rejected" } }, 401) };
    authenticated = true;
    const role = ROLES.includes(auth.role as WorkspaceRole) ? (auth.role as WorkspaceRole) : "viewer";
    actor = { tenantId: auth.tenantId, userId: auth.publicId, role };
  } else if (!authRequired()) {
    actor = { tenantId: WORKSPACE_TENANT, userId: "preview", role: "owner" };
  } else {
    return { ok: false, response: json({ error: { code: "UNAUTHORIZED", message: "An API key is required" } }, 401) };
  }
  const tenantId = resource.tenantId ?? actor.tenantId;
  const decision = authorize({ actor, action, resource: { tenantId, type: resource.type, id: resource.id } });
  if (!decision.allow) {
    return { ok: false, response: json({ error: { code: "FORBIDDEN", message: decision.reason } }, 403) };
  }
  return { ok: true, actor, authenticated };
}
