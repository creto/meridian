import type { FormComponent } from "./types.ts";

export interface NodeLocation {
  component: FormComponent;
  parent: FormComponent | null;
  list: FormComponent[];
  index: number;
}

export function walkComponents(
  components: FormComponent[],
  visit: (loc: NodeLocation) => void,
  parent: FormComponent | null = null,
): void {
  components.forEach((component, index) => {
    visit({ component, parent, list: components, index });
    if (component.components) walkComponents(component.components, visit, component);
    component.columns?.forEach((col) => walkComponents(col.components, visit, component));
  });
}

export function findComponent(components: FormComponent[], id: string): NodeLocation | null {
  let found: NodeLocation | null = null;
  walkComponents(components, (loc) => {
    if (loc.component.id === id) found = loc;
  });
  return found;
}

export function mapComponents(
  components: FormComponent[],
  mapper: (component: FormComponent) => FormComponent,
): FormComponent[] {
  return components.map((component) => {
    const next = mapper(component);
    return {
      ...next,
      components: next.components ? mapComponents(next.components, mapper) : undefined,
      columns: next.columns?.map((col) => ({
        ...col,
        components: mapComponents(col.components, mapper),
      })),
    };
  });
}

export function updateComponent(
  components: FormComponent[],
  id: string,
  patch: Partial<FormComponent>,
): FormComponent[] {
  return mapComponents(components, (component) => (component.id === id ? { ...component, ...patch } : component));
}

export function removeComponent(components: FormComponent[], id: string): FormComponent[] {
  const strip = (list: FormComponent[]): FormComponent[] =>
    list
      .filter((component) => component.id !== id)
      .map((component) => ({
        ...component,
        components: component.components ? strip(component.components) : undefined,
        columns: component.columns?.map((col) => ({ ...col, components: strip(col.components) })),
      }));
  return strip(components);
}

export function insertComponent(
  components: FormComponent[],
  component: FormComponent,
  parentId: string | null,
  index: number,
): FormComponent[] {
  if (!parentId) {
    const next = components.slice();
    next.splice(Math.max(0, Math.min(index, next.length)), 0, component);
    return next;
  }
  return mapComponents(components, (current) => {
    if (current.id !== parentId) return current;
    if (current.columns && current.columns.length > 0) {
      const columns = current.columns.map((col, i) => {
        if (i !== 0) return col;
        const list = col.components.slice();
        list.splice(Math.max(0, Math.min(index, list.length)), 0, component);
        return { ...col, components: list };
      });
      return { ...current, columns };
    }
    const list = (current.components ?? []).slice();
    list.splice(Math.max(0, Math.min(index, list.length)), 0, component);
    return { ...current, components: list };
  });
}

export function insertIntoColumn(
  components: FormComponent[],
  columnParentId: string,
  columnIndex: number,
  component: FormComponent,
  index: number,
): FormComponent[] {
  return mapComponents(components, (current) => {
    if (current.id !== columnParentId || !current.columns) return current;
    const columns = current.columns.map((col, i) => {
      if (i !== columnIndex) return col;
      const list = col.components.slice();
      list.splice(Math.max(0, Math.min(index, list.length)), 0, component);
      return { ...col, components: list };
    });
    return { ...current, columns };
  });
}

export function moveComponent(components: FormComponent[], id: string, direction: -1 | 1): FormComponent[] {
  const loc = findComponent(components, id);
  if (!loc) return components;
  const nextIndex = loc.index + direction;
  if (nextIndex < 0 || nextIndex >= loc.list.length) return components;
  const reorder = (list: FormComponent[]): FormComponent[] => {
    if (list !== loc.list && !list.some((item) => item.id === id)) {
      return list.map((item) => ({
        ...item,
        components: item.components ? reorder(item.components) : undefined,
        columns: item.columns?.map((col) => ({ ...col, components: reorder(col.components) })),
      }));
    }
    if (!list.some((item) => item.id === id)) return list;
    const copy = list.slice();
    const from = copy.findIndex((item) => item.id === id);
    const target = from + direction;
    if (target < 0 || target >= copy.length) return list;
    const [item] = copy.splice(from, 1);
    if (!item) return list;
    copy.splice(target, 0, item);
    return copy;
  };
  return reorder(components);
}

export function duplicateComponent(components: FormComponent[], id: string, copy: FormComponent): FormComponent[] {
  const loc = findComponent(components, id);
  if (!loc) return components;
  const inject = (list: FormComponent[]): FormComponent[] => {
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      const next = list.slice();
      next.splice(index + 1, 0, copy);
      return next;
    }
    return list.map((item) => ({
      ...item,
      components: item.components ? inject(item.components) : undefined,
      columns: item.columns?.map((col) => ({ ...col, components: inject(col.components) })),
    }));
  };
  return inject(components);
}

export function cloneComponentTree(component: FormComponent, newId: (key: string) => string, newKey: (key: string) => string): FormComponent {
  const next: FormComponent = {
    ...component,
    id: newId(component.key),
    key: newKey(component.key),
    values: component.values?.map((v) => ({ ...v })),
    validate: component.validate ? { ...component.validate } : undefined,
    pdf: component.pdf ? { ...component.pdf } : undefined,
    components: component.components?.map((child) => cloneComponentTree(child, newId, newKey)),
    columns: component.columns?.map((col) => ({
      width: col.width,
      components: col.components.map((child) => cloneComponentTree(child, newId, newKey)),
    })),
  };
  return next;
}

export function collectKeys(components: FormComponent[]): string[] {
  const keys: string[] = [];
  walkComponents(components, ({ component }) => {
    if (component.key) keys.push(component.key);
  });
  return keys;
}

export function flattenInputs(components: FormComponent[]): FormComponent[] {
  const inputs: FormComponent[] = [];
  walkComponents(components, ({ component }) => {
    if (!isLayout(component) && component.type !== "hidden") inputs.push(component);
    else if (component.type === "hidden") inputs.push(component);
  });
  return inputs.filter((c) => c.type !== "content" && c.type !== "button" && c.type !== "review");
}

export function isLayout(component: FormComponent): boolean {
  return component.type === "panel" || component.type === "columns" || component.type === "fieldset" || component.type === "tabs" || component.type === "content" || component.type === "button" || component.type === "review";
}

export function descendantIds(component: FormComponent): Set<string> {
  const ids = new Set<string>();
  walkComponents([component], ({ component: c }) => ids.add(c.id));
  return ids;
}
