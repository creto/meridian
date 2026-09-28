import { toJsonSchema } from "../forms/schema-export.ts";
import type { FormDefinition } from "../forms/types.ts";

/** MCP tool descriptors. Invocations go through the agent HTTP API. */
export function mcpTools(forms: FormDefinition[]) {
  const published = forms.filter((form) => form.status === "published");
  const staticTools = [
    { name: "forms.list", description: "List forms.", inputSchema: { type: "object", properties: {} } },
    { name: "forms.get", description: "Read one form by name.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "forms.generate", description: "Draft a form from a description using the local designer.", inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
    { name: "forms.validate", description: "Validate an object against a form.", inputSchema: { type: "object", properties: { name: { type: "string" }, data: { type: "object" } }, required: ["name", "data"] } },
    { name: "submissions.create", description: "Submit an object. Send Idempotency-Key.", inputSchema: { type: "object", properties: { name: { type: "string" }, data: { type: "object" }, idempotencyKey: { type: "string" } }, required: ["name", "data"] } },
    { name: "submissions.get", description: "Read a submission by id.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
    { name: "submissions.update", description: "Replace submission data.", inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object" } }, required: ["id", "data"] } },
  ];
  const perForm = published.map((form) => ({
    name: `forms.submit.${form.name}`.replace(/[^A-Za-z0-9_.]/g, "_"),
    description: `Submit ${form.title}.`.slice(0, 400),
    inputSchema: toJsonSchema(form),
  }));
  return { tools: [...staticTools, ...perForm] };
}
