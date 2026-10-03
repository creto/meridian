import { createFileRoute } from "@tanstack/react-router";
import { getVaultSecret, setVaultSecret } from "@/lib/storage/vault";
import { sha256Hex } from "@/lib/storage/sigv4";
import { guard } from "@/lib/authz/http-gate";
import { blockedDestination, fetchGuarded } from "@/lib/security/ssrf";

export const Route = createFileRoute("/api/hooks/deliver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gated = await guard(request, "webhook.manage", { type: "webhook" });
        if (!gated.ok) return gated.response;
        const body = (await request.json()) as { webhookId?: string; url?: string; secret?: string; event?: string; payload?: unknown };
        if (!body.url || !body.event) return Response.json({ ok: false, message: "url and event are required" }, { status: 400 });
        const blocked = blockedDestination(body.url);
        if (blocked) return Response.json({ ok: false, message: blocked }, { status: 400 });
        if (body.webhookId && body.secret) setVaultSecret(body.webhookId, body.secret);
        if (body.event === "webhook.secret") {
          return Response.json({ ok: true, stored: Boolean(body.webhookId && body.secret), delivered: false });
        }
        const secret = body.webhookId ? getVaultSecret(body.webhookId) : undefined;
        const raw = JSON.stringify({ event: body.event, payload: body.payload ?? null });
        const timestamp = String(Date.now());
        const headers: Record<string, string> = { "content-type": "application/json", "x-meridian-event": body.event, "x-meridian-timestamp": timestamp };
        if (secret) {
          const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
          const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`));
          headers["x-meridian-signature"] = `sha256=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
        }
        const attempts: { status: number; error?: string }[] = [];
        for (let i = 0; i < 3; i += 1) {
          try {
            const response = await fetchGuarded(body.url, { method: "POST", headers, body: raw });
            attempts.push({ status: response.status });
            if (response.ok || (response.status < 500 && response.status !== 429)) break;
          } catch (error) {
            attempts.push({ status: 0, error: error instanceof Error ? error.message : "network" });
          }
          await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** i));
        }
        const last = attempts[attempts.length - 1];
        return Response.json({ ok: Boolean(last && last.status >= 200 && last.status < 300), attempts, signed: Boolean(secret), sha256: await sha256Hex(raw) });
      },
    },
  },
});
