import { createFileRoute } from "@tanstack/react-router";
import { runStoragePut } from "@/lib/storage/execute";
import { getVaultSecret } from "@/lib/storage/vault";
import type { StorageKind } from "@/lib/storage/types";
import { guard } from "@/lib/authz/http-gate";

export const Route = createFileRoute("/api/storage/put")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gated = await guard(request, "storage.manage", { type: "storage" });
        if (!gated.ok) return gated.response;
        const body = (await request.json()) as {
          connectionId?: string;
          kind?: StorageKind;
          config?: Record<string, string>;
          key?: string;
          contentType?: string;
          bodyBase64?: string;
        };
        if (!body.connectionId || !body.kind || !body.key || !body.bodyBase64) {
          return Response.json({ ok: false, code: "BAD_REQUEST", message: "connectionId, kind, key, and body are required" }, { status: 400 });
        }
        const secret = getVaultSecret(body.connectionId);
        if (body.kind !== "local" && !secret) {
          return Response.json({ ok: false, code: "NOT_CONFIGURED", message: "No credential is loaded for this connection. Test it from Admin so the secret is stored in the server vault." }, { status: 409 });
        }
        const result = await runStoragePut(body.kind, body.config ?? {}, secret, body.key, body.bodyBase64, body.contentType || "application/octet-stream");
        return Response.json({ ...result, provider: body.kind, path: result.ok ? result.key : undefined }, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
