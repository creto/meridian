import { createFileRoute } from "@tanstack/react-router";
import { bootPlatform } from "@/lib/platform/durable-server";

export const Route = createFileRoute("/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await bootPlatform();
          return Response.json({ ok: true, status: "ready", persistence: "postgresql" });
        } catch (error) {
          return Response.json({ ok: false, status: "not-ready", message: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 });
        }
      },
    },
  },
});
