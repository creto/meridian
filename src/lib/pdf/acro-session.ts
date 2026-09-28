/**
 * AcroForm mapping session. Detection stays in acroform.ts.
 * This file only suggests, stores, and turns mappings into editor placements.
 */
import type { Placement, PdfFieldType } from "./editor-model.ts";
import { createPlacement } from "./editor-model.ts";

export interface DetectedField {
  name: string;
  type: string;
  page: number | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

export interface FormKey {
  key: string;
  label: string;
  type: string;
}

export interface Suggestion {
  pdfField: string;
  componentKey: string;
  score: number;
  reason: string;
}

export interface AcroSession {
  fields: DetectedField[];
  components: FormKey[];
  mapping: Record<string, string>;
  warnings: string[];
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function typeAffinity(pdfType: string, componentType: string): number {
  const pdf = pdfType.toLowerCase();
  const component = componentType.toLowerCase();
  if (pdf === "checkbox" && (component === "checkbox" || component === "toggle")) return 0.25;
  if ((pdf === "radio" || pdf === "dropdown") && (component === "radio" || component === "select")) return 0.25;
  if (pdf === "signature" && component === "signature") return 0.3;
  if (pdf === "text" && ["textfield", "email", "phone", "number", "currency", "date", "textarea"].includes(component)) return 0.1;
  return 0;
}

export function suggestMappings(fields: DetectedField[], components: FormKey[]): Suggestion[] {
  const used = new Set<string>();
  const ranked: Suggestion[] = [];
  for (const field of fields) {
    const fieldName = norm(field.name);
    let best: Suggestion | null = null;
    for (const component of components) {
      if (used.has(component.key)) continue;
      const key = norm(component.key);
      const label = norm(component.label);
      let score = typeAffinity(field.type, component.type);
      let reason = "type";
      if (fieldName && fieldName === key) {
        score += 1;
        reason = "exact key";
      } else if (fieldName && fieldName === label) {
        score += 0.8;
        reason = "label";
      } else if (fieldName && (fieldName.includes(key) || key.includes(fieldName))) {
        score += 0.45;
        reason = "partial key";
      }
      if (!best || score > best.score) best = { pdfField: field.name, componentKey: component.key, score, reason };
    }
    if (best && best.score >= 0.45) {
      used.add(best.componentKey);
      ranked.push(best);
    }
  }
  return ranked.sort((a, b) => b.score - a.score);
}

export function startAcroSession(fields: DetectedField[], components: FormKey[]): AcroSession {
  const suggestions = suggestMappings(fields, components);
  const mapping: Record<string, string> = {};
  for (const suggestion of suggestions) mapping[suggestion.pdfField] = suggestion.componentKey;
  return { fields, components, mapping, warnings: sessionWarnings({ fields, components, mapping, warnings: [] }) };
}

export function applyManualMap(session: AcroSession, pdfField: string, componentKey: string | null): AcroSession {
  const mapping = { ...session.mapping };
  if (componentKey == null || componentKey === "") delete mapping[pdfField];
  else mapping[pdfField] = componentKey;
  const next = { ...session, mapping };
  return { ...next, warnings: sessionWarnings(next) };
}

export function sessionWarnings(session: AcroSession): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, string>();
  for (const [pdfField, key] of Object.entries(session.mapping)) {
    if (!session.components.some((component) => component.key === key)) warnings.push(`${pdfField} maps to unknown key ${key}`);
    const prior = seen.get(key);
    if (prior) warnings.push(`${key} is mapped from both ${prior} and ${pdfField}`);
    seen.set(key, pdfField);
  }
  for (const field of session.fields) {
    if (!session.mapping[field.name]) warnings.push(`${field.name} is unmapped`);
  }
  return warnings;
}

export function unmappedFields(session: AcroSession): DetectedField[] {
  return session.fields.filter((field) => !session.mapping[field.name]);
}

function pdfType(field: DetectedField): PdfFieldType {
  const type = field.type.toLowerCase();
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "dropdown" || type === "option-list") return "select";
  if (type === "signature") return "signature";
  return "text";
}

export function sessionToPlacements(session: AcroSession): Placement[] {
  const placements: Placement[] = [];
  for (const field of session.fields) {
    const key = session.mapping[field.name];
    if (!key) continue;
    if (field.page == null || field.x == null || field.y == null || field.w == null || field.h == null) continue;
    placements.push(createPlacement({
      page: field.page,
      x: field.x,
      y: field.y,
      w: field.w,
      h: field.h,
      componentKey: key,
      pdfFieldType: pdfType(field),
    }));
  }
  return placements;
}
