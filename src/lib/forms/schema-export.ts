import { isLayout, walkComponents } from "./tree.ts";
import type { FormComponent, FormDefinition } from "./types.ts";

function fieldSchema(component: FormComponent): Record<string, unknown> {
  const description = [component.description, component.conditional ? `Visible when: ${component.conditional}` : ""]
    .filter(Boolean)
    .join(" ");
  const base: Record<string, unknown> = { title: component.label };
  if (description) base.description = description;
  switch (component.type) {
    case "number":
    case "currency":
    case "slider":
    case "rating":
      return { ...base, type: "number" };
    case "checkbox":
    case "toggle":
      return { ...base, type: "boolean" };
    case "select":
    case "radio":
      return { ...base, type: "string", enum: (component.values ?? []).map((v) => v.value) };
    case "selectboxes":
      return { ...base, type: "array", items: { type: "string", enum: (component.values ?? []).map((v) => v.value) } };
    case "datagrid":
      return { ...base, type: "array", items: objectSchema(component.components ?? []) };
    case "container":
    case "address":
      if (component.type === "address") {
        return {
          ...base,
          type: "object",
          properties: {
            line1: { type: "string", title: "Street" },
            city: { type: "string", title: "City" },
            region: { type: "string", title: "Region" },
            postalCode: { type: "string", title: "Postal code" },
            country: { type: "string", title: "Country" },
          },
        };
      }
      return { ...base, ...objectSchema(component.components ?? []) };
    case "file":
      return {
        ...base,
        type: "object",
        properties: {
          name: { type: "string" },
          size: { type: "integer" },
          type: { type: "string" },
          sha256: { type: "string" },
        },
        required: ["name", "sha256"],
      };
    default:
      return { ...base, type: "string" };
  }
}

function objectSchema(components: FormComponent[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const visit = (list: FormComponent[]) => {
    for (const component of list) {
      if (component.type === "columns") {
        component.columns?.forEach((col) => visit(col.components));
        continue;
      }
      if (component.type === "panel" || component.type === "fieldset" || component.type === "tabs") {
        visit(component.components ?? []);
        continue;
      }
      if (isLayout(component) || !component.key) continue;
      properties[component.key] = fieldSchema(component);
      if (component.required && !component.conditional) required.push(component.key);
    }
  };
  visit(components);
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

export function toJsonSchema(form: Pick<FormDefinition, "title" | "name" | "components">): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `form://${form.name}`,
    title: form.title,
    ...objectSchema(form.components),
  };
}

export function inputLabels(form: Pick<FormDefinition, "components">): { key: string; label: string }[] {
  const labels: { key: string; label: string }[] = [];
  walkComponents(form.components, ({ component, parent }) => {
    if (parent?.type === "datagrid" || parent?.type === "container") return;
    if (!component.key || isLayout(component) || component.type === "button") return;
    if (component.type === "datagrid" || component.type === "container" || component.type === "hidden") {
      labels.push({ key: component.key, label: component.label });
      return;
    }
    labels.push({ key: component.key, label: component.label });
  });
  const seen = new Set<string>();
  return labels.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

export function toCapabilities(form: FormDefinition) {
  return {
    form: form.name,
    title: form.title,
    version: form.version,
    status: form.status,
    capabilities: {
      create: form.status !== "archived",
      update: true,
      attachments: true,
      workflow: !!form.workflow,
      pdf: true,
    },
    operations: [
      {
        name: `submit_${form.name}`,
        description: `Validate and store a ${form.title} submission`,
        inputSchema: toJsonSchema(form),
      },
    ],
  };
}

export function toToolDefinition(form: FormDefinition) {
  return {
    name: `submit_${form.name}`.replace(/[^A-Za-z0-9_]/g, "_"),
    description: `Submit ${form.title}. Returns submissionId and workflow state.`,
    inputSchema: toJsonSchema(form),
  };
}
