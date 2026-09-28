import { createFileRoute } from "@tanstack/react-router";
import { CONSOLE_TENANT, consoleAct, consoleSnapshot, takeInviteToken, type ConsoleCommand } from "@/lib/admin/console";
import { getSql } from "@/lib/db";
import { replaceOverlays } from "@/lib/pdf/overlay-store";
import type { Placement } from "@/lib/pdf/editor-model";
import { applySecurityHeaders } from "@/lib/security/http";

function json(body: unknown, status = 200): Response {
  return applySecurityHeaders(Response.json(body, { status }));
}

function splatOf(params: unknown): string {
  return String((params as { _splat?: string })._splat ?? "");
}

async function read(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant") || CONSOLE_TENANT;
  const sql = await getSql();
  const snapshot = await consoleSnapshot(sql, tenantId);
  return json(snapshot);
}

async function write(request: Request, splat: string): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant") || CONSOLE_TENANT;
  const body = await request.json().catch(() => null) as (ConsoleCommand & { templateId?: string; templateVersion?: number; placements?: Placement[] }) | null;
  if (!body) return json({ error: { code: "BAD_REQUEST", message: "JSON body is required" } }, 400);
  const sql = await getSql();
  if (splat === "overlays") {
    if (!body.templateId || !Array.isArray(body.placements)) {
      return json({ error: { code: "BAD_REQUEST", message: "templateId and placements are required" } }, 400);
    }
    try {
      await sql.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, "Northwind"]);
      const saved = await replaceOverlays(sql, tenantId, body.templateId, Number(body.templateVersion ?? 1), body.placements);
      return json({ saved, templateId: body.templateId, templateVersion: Number(body.templateVersion ?? 1) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save overlays";
      return json({ error: { code: "OVERLAY", message } }, 422);
    }
  }
  if (!body.action) return json({ error: { code: "BAD_REQUEST", message: "action is required" } }, 400);
  try {
    const snapshot = await consoleAct(sql, tenantId, body);
    const taken = takeInviteToken(snapshot);
    return json({ snapshot: taken.snapshot, inviteToken: taken.token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Console command failed";
    const status = /required|must be|Unknown|not found|blocked/i.test(message) ? 422 : 500;
    return json({ error: { code: "CONSOLE", message } }, status);
  }
}

export const Route = createFileRoute("/api/admin/$")({
  server: {
    handlers: {
      GET: ({ request }) => read(request),
      POST: ({ request, params }) => write(request, splatOf(params)),
    },
  },
});
