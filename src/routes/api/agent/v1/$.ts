import { createFileRoute } from "@tanstack/react-router";
import { handleAgent } from "@/lib/platform/agent-http";

export const Route = createFileRoute("/api/agent/v1/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleAgent("GET", String((params as { _splat?: string })._splat ?? ""), request),
      POST: async ({ request, params }) => handleAgent("POST", String((params as { _splat?: string })._splat ?? ""), request),
      PATCH: async ({ request, params }) => handleAgent("PATCH", String((params as { _splat?: string })._splat ?? ""), request),
    },
  },
});
