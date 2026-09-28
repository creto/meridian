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
    values: component.values ?? [],
    pattern: component.validate?.pattern ?? "",
  });
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
      changed.push(`${component.label || key}: ${notes.join(", ") || "configuration changed"}`);
    }
  }
  for (const [key, component] of a) {
    if (key.includes(":") || seen.has(key)) continue;
    removed.push(`${component.label || key} (${component.type})`);
  }
  return { added, removed, changed };
}
