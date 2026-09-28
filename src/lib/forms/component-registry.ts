import type { ComponentType, FormComponent } from "./types.ts";

export type ComponentGroup = "input" | "choice" | "layout" | "advanced";

export interface ComponentDescriptor {
  type: ComponentType;
  group: ComponentGroup;
  label: string;
  defaultRequired: boolean;
  /** False for content, button, and review — they do not accept conditional or calculate logic. */
  acceptsLogic: boolean;
  jsonSchema: (component: FormComponent) => Record<string, unknown>;
  formioTypes: string[];
  agentHint: string;
}

export interface UnsupportedType {
  name: string;
  reason: string;
}

/** Requested by agents but absent from the ComponentType union. Not renderers. */
export const UNSUPPORTED_TYPES: UnsupportedType[] = [
  {
    name: "percentage",
    reason: "Percentage is not in the ComponentType schema yet. Use number or slider.",
  },
  {
    name: "tags",
    reason: "Tags are not in the ComponentType schema yet.",
  },
  {
    name: "image",
    reason: "Image is not in the ComponentType schema yet. Use file or content.",
  },
  {
    name: "accordion",
    reason: "Accordion is not in the ComponentType schema yet. Use panel.",
  },
  {
    name: "key-value",
    reason: "Key-value is not in the ComponentType schema yet. Use datagrid or container.",
  },
  {
    name: "json editor",
    reason: "JSON editor is not in the ComponentType schema yet.",
  },
  {
    name: "lookup",
    reason: "Lookup is not in the ComponentType schema yet. Use select.",
  },
];

function annotate(
  component: FormComponent,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...schema, title: component.label };
  if (component.description) next.description = component.description;
  if (next.type === "string") {
    if (component.validate?.minLength != null) next.minLength = component.validate.minLength;
    if (component.validate?.maxLength != null) next.maxLength = component.validate.maxLength;
    if (component.validate?.pattern) next.pattern = component.validate.pattern;
  }
  return next;
}

function objectFromComponents(components: FormComponent[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const visit = (list: FormComponent[]) => {
    for (const child of list) {
      if (child.type === "columns") {
        child.columns?.forEach((col) => visit(col.components));
        continue;
      }
      if (child.type === "panel" || child.type === "fieldset" || child.type === "tabs") {
        visit(child.components ?? []);
        continue;
      }
      if (
        child.type === "content" ||
        child.type === "button" ||
        child.type === "review" ||
        !child.key
      ) {
        continue;
      }
      properties[child.key] = jsonSchemaFor(child);
      if (child.required && !child.conditional) required.push(child.key);
    }
  };
  visit(components);
  return { type: "object", properties, required, additionalProperties: false };
}

function jsonSchemaFor(component: FormComponent): Record<string, unknown> {
  switch (component.type) {
    case "textfield":
    case "textarea":
    case "phone":
    case "hidden":
      return annotate(component, { type: "string" });
    case "password":
      return annotate(component, { type: "string", writeOnly: true });
    case "email":
      return annotate(component, { type: "string", format: "email" });
    case "url":
      return annotate(component, { type: "string", format: "uri" });
    case "date":
      return annotate(component, { type: "string", format: "date" });
    case "datetime":
      return annotate(component, { type: "string", format: "date-time" });
    case "time":
      return annotate(component, { type: "string", format: "time" });
    case "number":
    case "currency":
    case "slider":
    case "rating": {
      const schema: Record<string, unknown> = {
        type: component.type === "rating" ? "integer" : "number",
      };
      const min = component.validate?.min ?? component.min;
      const max = component.validate?.max ?? component.max;
      if (min != null) schema.minimum = min;
      if (max != null) schema.maximum = max;
      return annotate(component, schema);
    }
    case "checkbox":
    case "toggle":
      return annotate(component, { type: "boolean" });
    case "select":
    case "radio":
      return annotate(component, {
        type: "string",
        enum: (component.values ?? []).map((item) => item.value),
      });
    case "selectboxes":
      return annotate(component, {
        type: "array",
        uniqueItems: true,
        items: {
          type: "string",
          enum: (component.values ?? []).map((item) => item.value),
        },
      });
    case "file":
      return annotate(component, {
        type: "object",
        properties: {
          name: { type: "string" },
          size: { type: "integer" },
          type: { type: "string" },
          sha256: { type: "string" },
        },
        required: ["name", "sha256"],
      });
    case "signature":
      return annotate(component, { type: "string", contentMediaType: "image/png" });
    case "address":
      return annotate(component, {
        type: "object",
        properties: {
          line1: { type: "string", title: "Street" },
          city: { type: "string", title: "City" },
          region: { type: "string", title: "Region" },
          postalCode: { type: "string", title: "Postal code" },
          country: { type: "string", title: "Country" },
        },
      });
    case "datagrid":
      return annotate(component, {
        type: "array",
        items: objectFromComponents(component.components ?? []),
      });
    case "container":
      return annotate(component, objectFromComponents(component.components ?? []));
    case "columns":
      return annotate(
        component,
        objectFromComponents((component.columns ?? []).flatMap((col) => col.components)),
      );
    case "panel":
    case "fieldset":
    case "tabs":
      return annotate(component, objectFromComponents(component.components ?? []));
    case "content":
    case "button":
    case "review":
      return annotate(component, { type: "null", readOnly: true });
    default: {
      const unreachable: never = component.type;
      return { title: component.label, type: "string", description: String(unreachable) };
    }
  }
}

function define(
  type: ComponentType,
  group: ComponentGroup,
  label: string,
  formioTypes: string[],
  agentHint: string,
  acceptsLogic = true,
): ComponentDescriptor {
  return {
    type,
    group,
    label,
    defaultRequired: false,
    acceptsLogic,
    formioTypes,
    agentHint,
    jsonSchema: (component) => jsonSchemaFor(component),
  };
}

const REGISTRY: Record<ComponentType, ComponentDescriptor> = {
  textfield: define(
    "textfield",
    "input",
    "Text",
    ["textfield"],
    "Single-line text stored as a string.",
  ),
  textarea: define(
    "textarea",
    "input",
    "Long text",
    ["textarea"],
    "Multi-line text stored as a string.",
  ),
  number: define("number", "input", "Number", ["number"], "Integer or decimal stored as a number."),
  password: define(
    "password",
    "input",
    "Password",
    ["password"],
    "Masked text stored as a write-only string.",
  ),
  email: define("email", "input", "Email", ["email"], "Email address stored as a string."),
  phone: define(
    "phone",
    "input",
    "Phone",
    ["phoneNumber", "phone"],
    "Telephone number stored as a string.",
  ),
  url: define("url", "input", "URL", ["url"], "Web address stored as a string."),
  hidden: define(
    "hidden",
    "input",
    "Hidden",
    ["hidden"],
    "Value stored with the submission but not shown.",
  ),
  select: define(
    "select",
    "choice",
    "Select",
    ["select"],
    "One choice from a fixed list, stored as the option value.",
  ),
  radio: define(
    "radio",
    "choice",
    "Radio",
    ["radio", "survey"],
    "One visible choice from a short list, stored as the option value.",
  ),
  checkbox: define(
    "checkbox",
    "choice",
    "Checkbox",
    ["checkbox"],
    "Yes or no stored as a boolean.",
  ),
  selectboxes: define(
    "selectboxes",
    "choice",
    "Checkboxes",
    ["selectboxes"],
    "Many choices stored as an array of option values.",
  ),
  toggle: define("toggle", "choice", "Toggle", [], "On or off stored as a boolean."),
  datetime: define(
    "datetime",
    "input",
    "Date and time",
    ["datetime"],
    "Instant stored as an ISO date-time string.",
  ),
  date: define("date", "input", "Date", ["day"], "Calendar date stored as an ISO date string."),
  time: define("time", "input", "Time", ["time"], "Time of day stored as a string."),
  currency: define(
    "currency",
    "input",
    "Currency",
    ["currency"],
    "Money amount stored as a number.",
  ),
  slider: define("slider", "input", "Slider", [], "Number chosen on a numeric range."),
  rating: define("rating", "input", "Rating", [], "Whole-number rating up to the field maximum."),
  content: define(
    "content",
    "layout",
    "Content",
    ["content", "htmlelement"],
    "Read-only heading or note with no submitted value.",
    false,
  ),
  panel: define(
    "panel",
    "layout",
    "Section",
    ["panel"],
    "Groups nested fields; wizard pages are panels.",
  ),
  columns: define(
    "columns",
    "layout",
    "Columns",
    ["columns"],
    "Places nested fields side by side without its own value.",
  ),
  fieldset: define(
    "fieldset",
    "layout",
    "Fieldset",
    ["fieldset"],
    "Labeled group of nested fields without its own value.",
  ),
  tabs: define("tabs", "layout", "Tabs", ["tabs"], "Tabbed groups of nested fields."),
  datagrid: define(
    "datagrid",
    "advanced",
    "Grid",
    ["datagrid", "editgrid"],
    "Repeating rows stored as an array of objects.",
  ),
  container: define(
    "container",
    "advanced",
    "Group",
    ["container"],
    "Nested object whose children are stored under this key.",
  ),
  file: define(
    "file",
    "advanced",
    "File",
    ["file"],
    "Upload stored as name, size, type, and sha256.",
  ),
  signature: define(
    "signature",
    "advanced",
    "Signature",
    ["signature"],
    "Drawn or typed signature stored as an image string.",
  ),
  address: define(
    "address",
    "advanced",
    "Address",
    ["address"],
    "Postal address stored as street, city, region, postal code, and country.",
  ),
  button: define(
    "button",
    "advanced",
    "Button",
    ["button"],
    "Submit action with no stored value.",
    false,
  ),
  review: define(
    "review",
    "advanced",
    "Review",
    [],
    "Read-only summary of answers before submit.",
    false,
  ),
};

export function registryEntry(type: ComponentType): ComponentDescriptor {
  const entry = REGISTRY[type];
  if (!entry) throw new Error(`Unknown component type “${type}”`);
  return entry;
}

export function allRegistryEntries(): ComponentDescriptor[] {
  return (Object.keys(REGISTRY) as ComponentType[]).map((type) => REGISTRY[type]);
}
