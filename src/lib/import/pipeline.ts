import { componentsFromJsonSchema, componentsFromProfiles, componentsFromSample, parseCsv, profileColumns } from "../forms/importing.ts";
import type { ColumnProfile } from "../forms/importing.ts";

export interface ImportInspection {
  kind: string;
  warnings: string[];
}

export interface DataProfile {
  field: string;
  label: string;
  inferredType: string;
  confidence: number;
  count: number;
  nullCount: number;
  uniqueCount: number;
  examples: string[];
  min?: string;
  max?: string;
  enumCandidate: boolean;
  identifierLikelihood: number;
}

export interface FormImporter {
  kind: string;
  canHandle(input: unknown): boolean;
  inspect(input: unknown): ImportInspection;
  profile(input: unknown): DataProfile[];
  convert(input: unknown): { title: string; components: unknown[] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
  return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function identifierLikelihood(field: string, uniqueCount: number, count: number): number {
  const named = /id|nit|email|uuid/i.test(field);
  if (named && count > 0 && uniqueCount === count) return 0.86;
  if (named) return 0.4;
  if (count > 0 && uniqueCount === count) return 0.25;
  return 0.05;
}

function enumCandidate(uniqueCount: number, count: number): boolean {
  return uniqueCount >= 2 && uniqueCount <= 8 && count >= uniqueCount;
}

function fromColumn(profile: ColumnProfile): DataProfile {
  const mapped: DataProfile = {
    field: profile.field,
    label: profile.field,
    inferredType: profile.inferredType,
    confidence: typeof profile.confidence === "number" ? profile.confidence : 0.5,
    count: profile.count,
    nullCount: profile.nullCount,
    uniqueCount: profile.uniqueCount,
    examples: profile.examples ?? [],
    enumCandidate: enumCandidate(profile.uniqueCount, profile.count),
    identifierLikelihood: identifierLikelihood(profile.field, profile.uniqueCount, profile.count),
  };
  if (typeof profile.min === "string") mapped.min = profile.min;
  if (typeof profile.max === "string") mapped.max = profile.max;
  return mapped;
}

function scalarType(value: unknown): string {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

export const csvImporter: FormImporter = {
  kind: "csv",
  canHandle(input) {
    return typeof input === "string" && /[,;\t\n]/.test(input);
  },
  inspect(input) {
    const warnings: string[] = [];
    if (typeof input !== "string") return { kind: "csv", warnings: ["CSV input must be text"] };
    const parsed = parseCsv(input);
    if (parsed.headers.length === 0) warnings.push("CSV has no headers");
    if (parsed.rows.length === 0) warnings.push("CSV has no data rows");
    return { kind: "csv", warnings };
  },
  profile(input) {
    if (typeof input !== "string") return [];
    return profileColumns(parseCsv(input).rows).map(fromColumn);
  },
  convert(input) {
    const rows = typeof input === "string" ? parseCsv(input).rows : [];
    return { title: "Imported CSV", components: componentsFromProfiles(profileColumns(rows)) };
  },
};

export const jsonSampleImporter: FormImporter = {
  kind: "json-sample",
  canHandle(input) {
    if (!isRecord(input)) return false;
    if (input.type === "object" && isRecord(input.properties)) return false;
    return Object.values(input).every(isScalar);
  },
  inspect(input) {
    const warnings: string[] = [];
    if (!isRecord(input)) warnings.push("Sample is not an object");
    else if (Object.keys(input).length === 0) warnings.push("Sample object is empty");
    return { kind: "json-sample", warnings };
  },
  profile(input) {
    if (!isRecord(input)) return [];
    return Object.entries(input).map(([field, value]) => {
      const text = value == null ? "" : String(value);
      const present = value == null || text.trim() === "" ? 0 : 1;
      const profile: DataProfile = {
        field,
        label: field,
        inferredType: scalarType(value),
        confidence: value == null ? 0.5 : 0.9,
        count: 1,
        nullCount: present === 0 ? 1 : 0,
        uniqueCount: present,
        examples: present ? [text] : [],
        enumCandidate: false,
        identifierLikelihood: identifierLikelihood(field, present, 1),
      };
      if (present) {
        profile.min = text;
        profile.max = text;
      }
      return profile;
    });
  },
  convert(input) {
    return { title: "Imported sample", components: componentsFromSample(input) };
  },
};

function schemaProfiles(input: Record<string, unknown>): DataProfile[] {
  if (!isRecord(input.properties)) return [];
  return Object.entries(input.properties).map(([field, raw]) => {
    const prop = isRecord(raw) ? raw : {};
    const enumValues = Array.isArray(prop.enum) ? prop.enum.map(String) : [];
    const format = typeof prop.format === "string" ? prop.format : "";
    let inferred = "string";
    if (prop.type === "boolean") inferred = "boolean";
    else if (prop.type === "number" || prop.type === "integer") inferred = "number";
    else if (prop.type === "array") inferred = "array";
    else if (prop.type === "object") inferred = "object";
    else if (format === "email" || /email/i.test(field)) inferred = "email";
    const count = enumValues.length;
    return {
      field,
      label: typeof prop.title === "string" ? prop.title : field,
      inferredType: inferred,
      confidence: typeof prop.type === "string" ? 0.8 : 0.5,
      count,
      nullCount: 0,
      uniqueCount: count,
      examples: enumValues.slice(0, 3),
      enumCandidate: enumCandidate(count, count),
      identifierLikelihood: identifierLikelihood(field, count, count),
    };
  });
}

export const jsonSchemaImporter: FormImporter = {
  kind: "json-schema",
  canHandle(input) {
    return isRecord(input) && input.type === "object" && isRecord(input.properties);
  },
  inspect(input) {
    const warnings: string[] = [];
    if (!isRecord(input) || !isRecord(input.properties)) warnings.push("JSON Schema is missing object properties");
    else if (Object.keys(input.properties).length === 0) warnings.push("JSON Schema properties are empty");
    return { kind: "json-schema", warnings };
  },
  profile(input) {
    return isRecord(input) ? schemaProfiles(input) : [];
  },
  convert(input) {
    const schema = isRecord(input) ? input : {};
    const title = typeof schema.title === "string" && schema.title.trim() ? schema.title : "Imported schema";
    return { title, components: componentsFromJsonSchema(schema) };
  },
};

export function chooseImporter(input: unknown): FormImporter | null {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const nested = chooseImporter(parsed);
        if (nested) return nested;
      } catch {
        /* not JSON; fall through to CSV */
      }
    }
    return csvImporter.canHandle(input) ? csvImporter : null;
  }
  if (jsonSchemaImporter.canHandle(input)) return jsonSchemaImporter;
  if (jsonSampleImporter.canHandle(input)) return jsonSampleImporter;
  return null;
}
