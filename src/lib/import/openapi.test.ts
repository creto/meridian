import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { importOpenApi } from "./openapi.ts";

function fieldId(key: string): string {
  return `fld_${createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
}

function petApi() {
  return {
    openapi: "3.0.3",
    info: { title: "Pets" },
    paths: {
      "/health": { get: { responses: { "200": { description: "ok" } } } },
      "/pets": {
        post: {
          summary: "Create pet",
          requestBody: {
            required: true,
            content: {
              "application/json; charset=utf-8": {
                schema: { $ref: "#/components/schemas/Pet" },
              },
            },
          },
        },
        put: {
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object", properties: { ignored: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Pet: {
          type: "object",
          required: ["email", "name"],
          properties: {
            name: { type: "string", title: "Pet name" },
            email: { type: "string", format: "email" },
            born: { type: "string", format: "date" },
            seen: { type: "string", format: "date-time" },
            site: { type: "string", format: "uri" },
            age: { type: "integer" },
            weight: { type: "number" },
            adopted: { type: "boolean" },
            status: { type: "string", enum: ["new", "done"] },
            tags: { type: "array", items: { type: "string" } },
            lines: {
              type: "array",
              items: {
                type: "object",
                required: ["sku"],
                properties: {
                  sku: { type: "string" },
                  qty: { type: "integer" },
                },
              },
            },
            external: { $ref: "https://example.com/schemas.json#/Owner" },
          },
        },
      },
    },
  };
}

test("imports the first JSON request body and maps schema features", () => {
  const doc = petApi();
  const imported = importOpenApi(doc);
  const again = importOpenApi(JSON.stringify(doc));
  assert.equal(imported.title, "Pets");
  assert.deepEqual(imported.components, again.components);
  assert.equal(imported.support.some((entry) => entry.feature === "requestBody" && entry.level === "FULLY_SUPPORTED"), true);
  const byKey = Object.fromEntries(imported.components.map((component) => [component.key, component]));
  assert.equal(byKey.email?.type, "email");
  assert.equal(byKey.email?.required, true);
  assert.equal(byKey.email?.id, fieldId("email"));
  assert.equal(byKey.name?.label, "Pet name");
  assert.equal(byKey.name?.id, fieldId("name"));
  assert.equal(byKey.born?.type, "date");
  assert.equal(byKey.seen?.type, "datetime");
  assert.equal(byKey.site?.type, "url");
  assert.equal(byKey.age?.type, "number");
  assert.equal(byKey.weight?.type, "number");
  assert.equal(byKey.adopted?.type, "checkbox");
  assert.equal(byKey.status?.type, "select");
  assert.deepEqual(byKey.status?.values, [
    { label: "new", value: "new" },
    { label: "done", value: "done" },
  ]);
  assert.equal(byKey.tags?.type, "textfield");
  assert.equal(byKey.tags?.description, "multiple");
  assert.equal(byKey.lines?.type, "datagrid");
  assert.deepEqual(
    byKey.lines?.components?.map((child) => ({ key: child.key, type: child.type, required: child.required, id: child.id })),
    [
      { key: "sku", type: "textfield", required: true, id: fieldId("sku") },
      { key: "qty", type: "number", required: undefined, id: fieldId("qty") },
    ],
  );
  assert.equal(byKey.external, undefined);
  assert.equal(byKey.ignored, undefined);
  assert.equal(imported.support.some((entry) => entry.level === "UNSUPPORTED" && entry.detail.includes("$ref")), true);
  for (const entry of imported.support) {
    assert.ok(entry.level === "FULLY_SUPPORTED" || entry.level === "PARTIALLY_SUPPORTED" || entry.level === "UNSUPPORTED");
  }
});

test("opts select a path and method, and missing JSON bodies are unsupported", () => {
  const doc = petApi();
  const chosen = importOpenApi(doc, { path: "/pets", method: "PUT" });
  assert.deepEqual(chosen.components.map((component) => component.key), ["ignored"]);
  const getOnly = importOpenApi(doc, { path: "/health", method: "get" });
  assert.deepEqual(getOnly.components, []);
  assert.equal(getOnly.support.length, 1);
  assert.equal(getOnly.support[0]?.level, "UNSUPPORTED");
  assert.match(getOnly.support[0]?.detail ?? "", /No application\/json request body/);
  const swagger = importOpenApi({ swagger: "2.0", info: { title: "Old" }, paths: {} });
  assert.deepEqual(swagger.components, []);
  assert.equal(swagger.support[0]?.feature, "openapi");
  assert.equal(swagger.support[0]?.level, "UNSUPPORTED");
  assert.deepEqual(importOpenApi(null).components, []);
  assert.deepEqual(importOpenApi("{").components, []);
});

test("combinators keep the first branch and cyclic refs stop that branch", () => {
  const combined = importOpenApi({
    openapi: "3.1.0",
    info: { title: "Union" },
    paths: {
      "/mix": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      required: ["email"],
                      properties: { email: { type: "string", format: "email" } },
                    },
                    { type: "object", properties: { age: { type: "integer" } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });
  assert.deepEqual(combined.components.map((component) => component.key), ["email"]);
  assert.equal(combined.components[0]?.type, "email");
  assert.equal(combined.support.some((entry) => entry.feature === "oneOf" && entry.level === "PARTIALLY_SUPPORTED"), true);
  assert.match(combined.warnings.join(" "), /not merged/);
  assert.equal(combined.components.some((component) => component.key === "age"), false);

  const allOf = importOpenApi({
    openapi: "3.0.0",
    paths: {
      "/all": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { type: "object", properties: { a: { type: "string" } } },
                    { type: "object", properties: { b: { type: "boolean" } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });
  assert.deepEqual(allOf.components.map((component) => component.key), ["a"]);
  assert.equal(allOf.support.some((entry) => entry.feature === "allOf" && entry.level === "PARTIALLY_SUPPORTED"), true);

  const cyclic = importOpenApi({
    openapi: "3.0.3",
    info: { title: "Nodes" },
    paths: {
      "/nodes": {
        post: {
          requestBody: {
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Node" } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Node: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            child: { $ref: "#/components/schemas/Node" },
          },
        },
      },
    },
  });
  assert.deepEqual(cyclic.components.map((component) => component.key), ["name"]);
  assert.equal(cyclic.components[0]?.required, true);
  const cycle = cyclic.support.find((entry) => entry.level === "UNSUPPORTED" && /cyclic \$ref/.test(entry.detail));
  assert.ok(cycle);
  assert.match(cycle?.detail ?? "", /#\/components\/schemas\/Node/);
});
