import { createHash } from "node:crypto";

export type SupportLevel = "FULLY_SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED";

export interface ImportSupport {
  feature: string;
  level: SupportLevel;
  detail: string;
}

/** Structural form field. Not the forms FormComponent type, so this module cannot cycle through the form graph. */
export interface ImportedComponent {
  id: string;
  type: string;
  key: string;
  label: string;
  required?: boolean;
  values?: { label: string; value: string }[];
  description?: string;
  components?: ImportedComponent[];
}

export interface ImportResult {
  title: string;
  components: ImportedComponent[];
  support: ImportSupport[];
  warnings: string[];
}

export interface ImportOpenApiOptions {
  path?: string;
  method?: string;
}

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
const SCHEMA_PREFIX = "#/components/schemas/";
const MAX_DEPTH = 40;

interface SchemaRecord {
  [key: string]: unknown;
}

interface Ctx {
  schemas: Record<string, SchemaRecord>;
  support: ImportSupport[];
  warnings: string[];
}

interface Resolved {
  schema: SchemaRecord;
  stack: string[];
}

function isRecord(value: unknown): value is SchemaRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function fieldId(key: string): string {
  return `fld_${createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
}

function labelFromKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function decodePointerToken(token: string): string {
  return decodeURIComponent(token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function note(ctx: Ctx, feature: string, level: SupportLevel, detail: string, warning = detail): void {
  ctx.support.push({ feature, level, detail });
  ctx.warnings.push(warning);
}

function schemaMap(document: SchemaRecord): Record<string, SchemaRecord> {
  const components = isRecord(document.components) ? document.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  const out: Record<string, SchemaRecord> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    if (isRecord(schema)) out[name] = schema;
  }
  return out;
}

function derefRequestBody(document: SchemaRecord, ref: string, seen: string[]): SchemaRecord | null {
  if (seen.includes(ref)) return null;
  const prefix = "#/components/requestBodies/";
  if (!ref.startsWith(prefix) || ref.slice(prefix.length).includes("/")) return null;
  const name = decodePointerToken(ref.slice(prefix.length));
  const components = isRecord(document.components) ? document.components : {};
  const bodies = isRecord(components.requestBodies) ? components.requestBodies : {};
  const target = bodies[name];
  if (!isRecord(target)) return null;
  if (typeof target.$ref === "string") return derefRequestBody(document, target.$ref, [...seen, ref]);
  return target;
}

function jsonMediaSchema(document: SchemaRecord, operation: SchemaRecord): unknown | undefined {
  let body: unknown = operation.requestBody;
  if (isRecord(body) && typeof body.$ref === "string") {
    body = derefRequestBody(document, body.$ref, []);
  }
  if (!isRecord(body) || !isRecord(body.content)) return undefined;
  for (const [rawType, media] of Object.entries(body.content)) {
    const mime = rawType.split(";")[0]?.trim().toLowerCase();
    if (mime === "application/json" && isRecord(media) && "schema" in media) return media.schema;
  }
  return undefined;
}

interface OperationChoice {
  path: string;
  method: string;
  schema?: unknown;
  summary?: string;
}

function chooseOperation(document: SchemaRecord, opts?: ImportOpenApiOptions): OperationChoice | null {
  const paths = isRecord(document.paths) ? document.paths : null;
  if (!paths) return null;
  const wantPath = opts?.path;
  const wantMethod = opts?.method?.trim().toLowerCase();
  const pinned = Boolean(wantPath || wantMethod);
  for (const [path, item] of Object.entries(paths)) {
    if (wantPath && path !== wantPath) continue;
    if (!isRecord(item)) continue;
    for (const method of Object.keys(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (wantMethod && method.toLowerCase() !== wantMethod) continue;
      const operation = item[method];
      const op = isRecord(operation) ? operation : {};
      const schema = jsonMediaSchema(document, op);
      const summary = typeof op.summary === "string" ? op.summary : undefined;
      if (schema !== undefined) return { path, method: method.toLowerCase(), schema, summary };
      if (wantPath && wantMethod) return { path, method: method.toLowerCase(), summary };
    }
  }
  if (pinned) return { path: wantPath ?? "", method: wantMethod ?? "" };
  return null;
}

function primaryType(schema: SchemaRecord): string | undefined {
  const type = schema.type;
  if (typeof type === "string") return type;
  if (Array.isArray(type)) {
    const picked = type.find((item) => item !== "null" && typeof item === "string");
    return typeof picked === "string" ? picked : undefined;
  }
  return undefined;
}

function resolveRef(ref: string, ctx: Ctx, stack: string[]): Resolved | null {
  if (stack.includes(ref)) {
    note(ctx, "$ref", "UNSUPPORTED", `cyclic $ref ${ref}`, `Stopped branch at cyclic $ref ${ref}`);
    return null;
  }
  if (!ref.startsWith(SCHEMA_PREFIX) || ref.slice(SCHEMA_PREFIX.length).includes("/")) {
    note(ctx, "$ref", "UNSUPPORTED", `Unsupported $ref ${ref}`, `Unresolved $ref ${ref}`);
    return null;
  }
  const name = decodePointerToken(ref.slice(SCHEMA_PREFIX.length));
  const target = ctx.schemas[name];
  if (!target) {
    note(ctx, "$ref", "UNSUPPORTED", `Unresolved $ref ${ref}`, `Unresolved $ref ${ref}`);
    return null;
  }
  return resolveSchema(target, ctx, [...stack, ref]);
}

function resolveSchema(schema: unknown, ctx: Ctx, stack: string[]): Resolved | null {
  if (!isRecord(schema)) return null;
  if (typeof schema.$ref === "string") return resolveRef(schema.$ref, ctx, stack);
  const combinator = (["oneOf", "anyOf", "allOf"] as const).find((key) => Array.isArray(schema[key]));
  if (combinator) {
    const branches = schema[combinator] as unknown[];
    if (branches.length === 0) {
      note(ctx, combinator, "UNSUPPORTED", `${combinator} has no branches`);
      return null;
    }
    if (branches.length > 1) {
      note(
        ctx,
        combinator,
        "PARTIALLY_SUPPORTED",
        `Imported the first ${combinator} branch only; other branches were not merged`,
        `Other ${combinator} branches were not merged`,
      );
    }
    return resolveSchema(branches[0], ctx, stack);
  }
  return { schema, stack };
}

function enumValues(list: unknown[]): { label: string; value: string }[] {
  const values: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    let value: string;
    if (typeof item === "string") value = item;
    else if (typeof item === "number" || typeof item === "boolean") value = String(item);
    else if (item == null) value = "";
    else value = JSON.stringify(item);
    if (seen.has(value)) continue;
    seen.add(value);
    values.push({ label: value, value });
  }
  return values;
}

function isObjectSchema(schema: SchemaRecord): boolean {
  if (primaryType(schema) === "object") return true;
  return isRecord(schema.properties);
}

function noteAdditional(schema: SchemaRecord, ctx: Ctx, path: string): void {
  if (!("additionalProperties" in schema) || schema.additionalProperties === false) return;
  note(
    ctx,
    "additionalProperties",
    "PARTIALLY_SUPPORTED",
    `additionalProperties on ${path || "request body"} were not imported as fields`,
    `additionalProperties on ${path || "request body"} were not imported`,
  );
}

function noteTypeUnion(schema: SchemaRecord, ctx: Ctx): void {
  if (Array.isArray(schema.type) && schema.type.length > 1) {
    note(ctx, "type", "PARTIALLY_SUPPORTED", "Imported the first non-null type only; other type branches were not merged", "Other type union branches were not merged");
  }
}

function baseField(key: string, schema: SchemaRecord, required: boolean): ImportedComponent {
  const field: ImportedComponent = {
    id: fieldId(key),
    type: "textfield",
    key,
    label: typeof schema.title === "string" && schema.title.trim() ? schema.title.trim() : labelFromKey(key),
  };
  if (required) field.required = true;
  if (typeof schema.description === "string" && schema.description.trim()) field.description = schema.description.trim();
  return field;
}

function stringType(schema: SchemaRecord): string {
  switch (schema.format) {
    case "email":
      return "email";
    case "date":
      return "date";
    case "date-time":
      return "datetime";
    case "uri":
    case "url":
      return "url";
    default:
      return "textfield";
  }
}

function fieldsFromProperties(schema: SchemaRecord, ctx: Ctx, stack: string[], parentPath: string, depth: number): ImportedComponent[] {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : []);
  const fields: ImportedComponent[] = [];
  for (const [key, prop] of Object.entries(properties)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    const field = fieldFromSchema(key, prop, required.has(key), ctx, stack, path, depth + 1);
    if (field) fields.push(field);
  }
  return fields;
}

function fieldFromSchema(
  key: string,
  schema: unknown,
  required: boolean,
  ctx: Ctx,
  stack: string[],
  path: string,
  depth: number,
): ImportedComponent | null {
  if (depth > MAX_DEPTH) {
    note(ctx, "nesting", "UNSUPPORTED", `schema nesting exceeds ${MAX_DEPTH} levels at ${path}`);
    return null;
  }
  const resolved = resolveSchema(schema, ctx, stack);
  if (!resolved) return null;
  return interpret(key, resolved.schema, required, ctx, resolved.stack, path, depth);
}

function interpret(
  key: string,
  schema: SchemaRecord,
  required: boolean,
  ctx: Ctx,
  stack: string[],
  path: string,
  depth: number,
): ImportedComponent | null {
  noteTypeUnion(schema, ctx);
  if (Array.isArray(schema.enum)) {
    const field = baseField(key, schema, required);
    field.type = "select";
    field.values = enumValues(schema.enum);
    return field;
  }
  const type = primaryType(schema);
  if (type === "array" || schema.items !== undefined) {
    return arrayField(key, schema, required, ctx, stack, path, depth);
  }
  if (type === "object" || isRecord(schema.properties)) {
    noteAdditional(schema, ctx, path);
    const field = baseField(key, schema, required);
    field.type = "container";
    field.components = fieldsFromProperties(schema, ctx, stack, path, depth);
    return field;
  }
  const field = baseField(key, schema, required);
  if (type === "boolean") field.type = "checkbox";
  else if (type === "integer" || type === "number") field.type = "number";
  else if (type === "string" || type === undefined) {
    field.type = stringType(schema);
    if (type === undefined && !schema.format) {
      note(ctx, "type", "PARTIALLY_SUPPORTED", `Property ${path} has no type and was imported as ${field.type}`);
    }
  } else {
    field.type = "textfield";
    note(ctx, type, "UNSUPPORTED", `Type ${type} on ${path} was imported as textfield`);
  }
  return field;
}

function arrayField(
  key: string,
  schema: SchemaRecord,
  required: boolean,
  ctx: Ctx,
  stack: string[],
  path: string,
  depth: number,
): ImportedComponent {
  const field = baseField(key, schema, required);
  let items: unknown = schema.items;
  if (Array.isArray(items)) {
    note(ctx, "items", "PARTIALLY_SUPPORTED", `Imported the first items tuple branch of ${path} only; other branches were not merged`, `Other items branches of ${path} were not merged`);
    items = items[0];
  }
  const resolved = items === undefined ? null : resolveSchema(items, ctx, stack);
  if (!resolved) {
    field.type = "textfield";
    field.description = "multiple";
    note(ctx, "array", "PARTIALLY_SUPPORTED", `Array ${path} has no usable items schema and was imported as a multiple text field`);
    return field;
  }
  if (isObjectSchema(resolved.schema)) {
    noteAdditional(resolved.schema, ctx, path);
    field.type = "datagrid";
    field.components = fieldsFromProperties(resolved.schema, ctx, resolved.stack, path, depth);
    return field;
  }
  const itemType = primaryType(resolved.schema);
  if (Array.isArray(resolved.schema.enum) || itemType === "string" || itemType === undefined) {
    field.type = itemType === "string" || itemType === undefined ? "textfield" : "textfield";
    if (Array.isArray(resolved.schema.enum)) field.values = enumValues(resolved.schema.enum);
    field.description = "multiple";
    return field;
  }
  if (itemType === "integer" || itemType === "number") field.type = "number";
  else if (itemType === "boolean") field.type = "checkbox";
  else field.type = "textfield";
  field.description = "multiple";
  note(ctx, "array", "PARTIALLY_SUPPORTED", `Array of ${itemType} at ${path} was imported as a multiple ${field.type}`);
  return field;
}

function componentsFromBody(schema: unknown, ctx: Ctx): ImportedComponent[] {
  const resolved = resolveSchema(schema, ctx, []);
  if (!resolved) return [];
  const body = resolved.schema;
  noteTypeUnion(body, ctx);
  if (Array.isArray(body.enum)) {
    const field = baseField("body", body, false);
    field.type = "select";
    field.values = enumValues(body.enum);
    return [field];
  }
  if (primaryType(body) === "array" || body.items !== undefined) {
    const field = arrayField("body", body, false, ctx, resolved.stack, "body", 0);
    return [field];
  }
  if (isObjectSchema(body) || isRecord(body.properties)) {
    noteAdditional(body, ctx, "");
    return fieldsFromProperties(body, ctx, resolved.stack, "", 0);
  }
  const type = primaryType(body);
  if (!type && !body.format && !body.properties) return [];
  const field = baseField("body", body, false);
  if (type === "boolean") field.type = "checkbox";
  else if (type === "integer" || type === "number") field.type = "number";
  else if (type === "string") field.type = stringType(body);
  else field.type = "textfield";
  return [field];
}

function documentTitle(document: SchemaRecord, choice: OperationChoice | null): string {
  const info = isRecord(document.info) ? document.info : undefined;
  if (info && typeof info.title === "string" && info.title.trim()) return info.title.trim();
  if (choice?.summary?.trim()) return choice.summary.trim();
  return "Imported API";
}

function unsupported(title: string, feature: string, detail: string): ImportResult {
  return {
    title,
    components: [],
    support: [{ feature, level: "UNSUPPORTED", detail }],
    warnings: [detail],
  };
}

function asOpenApi(document: unknown): SchemaRecord | null {
  let value = document;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  if (typeof value.openapi !== "string" || !value.openapi.startsWith("3.")) return null;
  return value;
}

export function importOpenApi(document: unknown, opts?: ImportOpenApiOptions): ImportResult {
  const parsed = asOpenApi(document);
  if (!parsed) {
    return unsupported("Imported API", "openapi", "Document is not an OpenAPI 3 object");
  }
  const choice = chooseOperation(parsed, opts);
  const title = documentTitle(parsed, choice);
  if (!choice || choice.schema === undefined) {
    const target = choice?.path ? `${choice.method ? `${choice.method.toUpperCase()} ` : ""}${choice.path}`.trim() : "the document";
    return unsupported(title, "requestBody", `No application/json request body for ${target}`);
  }
  const ctx: Ctx = { schemas: schemaMap(parsed), support: [], warnings: [] };
  ctx.support.push({
    feature: "requestBody",
    level: "FULLY_SUPPORTED",
    detail: `${choice.method.toUpperCase()} ${choice.path} application/json`,
  });
  const components = componentsFromBody(choice.schema, ctx);
  if (components.length === 0 && !ctx.warnings.some((warning) => /no properties|not an OpenAPI|request body/i.test(warning))) {
    ctx.warnings.push("Request schema did not produce any fields");
  }
  return { title, components, support: ctx.support, warnings: ctx.warnings };
}
