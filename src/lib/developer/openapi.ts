import { ERRORS, OPERATIONS, type ApiOperation } from "./catalog.ts";

export interface OpenApiDocument {
  openapi: "3.0.3";
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
}

function operationObject(operation: ApiOperation): Record<string, unknown> {
  const parameters = operation.path.includes("{name}")
    ? [{ name: "name", in: "path", required: true, schema: { type: "string" } }]
    : [];
  return {
    operationId: operation.id,
    summary: operation.summary,
    tags: [operation.group],
    parameters,
    requestBody: operation.body
      ? { required: true, content: { "application/json": { schema: { type: "object" }, example: operation.body } } }
      : undefined,
    responses: {
      "200": { description: "Success" },
      "202": { description: "Accepted for background work" },
      "400": { description: "Bad request" },
      "401": { description: "Authentication or prefill failure" },
      "403": { description: "ABAC or scope denial" },
      "409": { description: "Stale revision" },
    },
    security: operation.auth === "none" ? [] : [{ apiKey: [] }],
  };
}

/** Platform OpenAPI built from the operations the running API actually exposes. */
export function platformOpenApi(): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  for (const operation of OPERATIONS) {
    const path = operation.path.replace(/\{(\w+)\}/g, "{$1}");
    const method = operation.method.toLowerCase();
    paths[path] ??= {};
    paths[path][method] = operationObject(operation);
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "Meridian platform API",
      version: "0.4.0",
      description: "Agent, platform, and admin routes served by this process. Connector calls and OIDC token signature checks stay unwired until credentials exist.",
    },
    paths,
    components: {
      securitySchemes: {
        apiKey: { type: "apiKey", in: "header", name: "authorization" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            code: { type: "string", enum: ERRORS.map((error) => error.code) },
            message: { type: "string" },
          },
        },
      },
    },
  };
}

export function pathCount(document: OpenApiDocument): number {
  return Object.keys(document.paths).length;
}
