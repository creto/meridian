import { createFileRoute } from "@tanstack/react-router";
import { handlePlatform } from "@/lib/platform/closure-http";

async function dispatch(method: string, request: Request, splat: string): Promise<Response> {
  const body = method === "GET" ? undefined : await request.json().catch(() => ({}));
  return handlePlatform({ method, path: splat, body, secret: request.headers.get("x-meridian-secret") ?? undefined });
}

export const Route = createFileRoute("/api/platform/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => dispatch("GET", request, String((params as { _splat?: string })._splat ?? "")),
      POST: ({ request, params }) => dispatch("POST", request, String((params as { _splat?: string })._splat ?? "")),
    },
  },
});
