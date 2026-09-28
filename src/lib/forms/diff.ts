import { walkComponents } from "./tree.ts";
import type { FormComponent } from "./types.ts";

export interface SemanticDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

function indexByKey(components: FormComponent[]): Map<string, FormComponent> {
  const map = new Map<string, FormComponent>();
  walkComponents(components, ({ component }) => {
    if (component.key) map.set(`${component.type}:${component.key}:${component.label}`, component);
    if (component.key) map.set(component.key, component);
  });
  return map;
}

function fingerprint(component: FormComponent): string {
  return JSON.stringify({
    type: component.type,
    label: component.label,
    required: !!component.required,
    conditional: component.conditional ?? "",
    calculateValue: component.calculateValue ?? "",
    hidden: !!component.hidden,
    placeholder: component.placeholder ?? "",
    values: component.values ?? [],
    pattern: component.validate?.pattern ?? "",
    formio: component.formio ?? {},
  });
}

function propertyNotes(prev: FormComponent, next: FormComponent): string[] {
  const notes: string[] = [];
  const pairs: [string, string][] = [
    ["placeholder", "Placeholder changed"],
    ["description", "Description changed"],
  ];
  for (const [key, message] of pairs) {
    if ((prev as unknown as Record<string, unknown>)[key] !== (next as unknown as Record<string, unknown>)[key]) notes.push(message);
  }
  if ((prev.validate?.pattern ?? "") !== (next.validate?.pattern ?? "")) notes.push("Validation regex changed");
  if (!!prev.hidden !== !!next.hidden) notes.push(next.hidden ? "Hidden" : "Shown");
  if (JSON.stringify(prev.formio?.inputMask ?? "") !== JSON.stringify(next.formio?.inputMask ?? "")) notes.push("Input mask changed");
  if (prev.formio?.clearOnHide !== next.formio?.clearOnHide) notes.push(next.formio?.clearOnHide === false ? "Clear-on-hide disabled" : "Clear-on-hide enabled");
  if (JSON.stringify(prev.formio?.dataSrc ?? "") !== JSON.stringify(next.formio?.dataSrc ?? "")) notes.push("Data source changed");
  if (JSON.stringify(prev.formio?.logic ?? null) !== JSON.stringify(next.formio?.logic ?? null)) notes.push("Logic rule changed");
  if (JSON.stringify(prev.formio?.conditional ?? null) !== JSON.stringify(next.formio?.conditional ?? null)) notes.push("Conditional changed");
  if ((prev.formio?.customClass ?? "") !== (next.formio?.customClass ?? "")) notes.push("Layout class changed");
  return notes;
}

export function semanticDiff(before: FormComponent[], after: FormComponent[]): SemanticDiff {
  const a = indexByKey(before);
  const b = indexByKey(after);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const seen = new Set<string>();
  for (const [key, component] of b) {
    if (key.includes(":")) continue;
    seen.add(key);
    const prev = a.get(key);
    if (!prev) added.push(`${component.label || key} (${component.type})`);
    else if (fingerprint(prev) !== fingerprint(component)) {
      const notes: string[] = [];
      if (prev.type !== component.type) notes.push(`type ${prev.type} → ${component.type}`);
      if (!!prev.required !== !!component.required) notes.push(component.required ? "now required" : "now optional");
      if ((prev.conditional ?? "") !== (component.conditional ?? "")) notes.push("visibility rule changed");
      if ((prev.calculateValue ?? "") !== (component.calculateValue ?? "")) notes.push("calculation changed");
      if (prev.label !== component.label) notes.push(`label “${prev.label}” → “${component.label}”`);
      notes.push(...propertyNotes(prev, component));
      changed.push(`${component.label || key}: ${[...new Set(notes)].join(", ") || "configuration changed"}`);
    }
  }
  for (const [key, component] of a) {
    if (key.includes(":") || seen.has(key)) continue;
    removed.push(`${component.label || key} (${component.type})`);
  }
  return { added, removed, changed };
}
