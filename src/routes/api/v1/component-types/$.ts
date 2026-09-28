import { createFileRoute } from "@tanstack/react-router";
import { componentTypesBody } from "@/lib/forms/formio/http";

export const Route = createFileRoute("/api/v1/component-types/$")({
  server: {
    handlers: {
      GET: ({ params }) => {
        const splat = String((params as { _splat?: string })._splat ?? "");
        const result = componentTypesBody(splat);
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
