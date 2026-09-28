import { createFileRoute } from "@tanstack/react-router";
import { runStorageTest } from "@/lib/storage/execute";
import { setVaultSecret, getVaultSecret } from "@/lib/storage/vault";
import type { StorageKind } from "@/lib/storage/types";

export const Route = createFileRoute("/api/storage/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { connectionId?: string; kind?: StorageKind; config?: Record<string, string>; secret?: string };
        const id = body.connectionId?.trim();
        if (!id || !body.kind) return Response.json({ ok: false, code: "BAD_REQUEST", message: "connectionId and kind are required" }, { status: 400 });
        if (body.secret) setVaultSecret(id, body.secret);
        const secret = getVaultSecret(id);
        const result = await runStorageTest(body.kind, body.config ?? {}, secret);
        return Response.json({ ...result, secretSet: Boolean(secret) });
      },
    },
  },
});
