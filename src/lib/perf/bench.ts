import { applyCalculations, validateForm } from "../forms/engine.ts";
import type { FormComponent, FormDefinition } from "../forms/types.ts";

export function virtualRange(total: number, viewport: number, rowHeight: number, scrollTop: number): { start: number; end: number } {
  const visible = Math.max(1, Math.ceil(viewport / rowHeight));
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const end = Math.min(total, start + visible + 4);
  return { start, end };
}

export function syntheticForm(fields: number): FormDefinition {
  const components: FormComponent[] = [];
  for (let index = 0; index < fields; index += 1) {
    components.push({
      id: `c${index}`,
      type: "number",
      key: `n${index}`,
      label: `Number ${index}`,
      required: index % 7 === 0,
      calculateValue: index > 0 && index % 3 === 0 ? `n${index - 1} + 1` : undefined,
    });
  }
  return {
    id: "perf",
    name: "perf",
    title: "Perf",
    description: "",
    display: "form",
    status: "draft",
    version: 1,
    hasUnpublishedChanges: true,
    components,
    settings: { submitLabel: "Send", draftLabel: "Draft", successMessage: "Ok", allowDraft: true },
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    pdfPages: 1,
    versions: [],
    activity: [],
  };
}

export function measure(label: string, fn: () => void): { label: string; ms: number } {
  const start = performance.now();
  fn();
  return { label, ms: performance.now() - start };
}

export function runFieldBench(sizes = [50, 200, 500, 1000]): Array<{ fields: number; calculateMs: number; validateMs: number }> {
  return sizes.map((fields) => {
    const form = syntheticForm(fields);
    const data: Record<string, unknown> = {};
    for (let index = 0; index < fields; index += 1) data[`n${index}`] = index;
    const calculate = measure("calculate", () => applyCalculations(form.components, data));
    const validate = measure("validate", () => validateForm(form, data));
    return { fields, calculateMs: calculate.ms, validateMs: validate.ms };
  });
}

export function runGridBench(): Array<{ rows: number; window: number }> {
  return [100, 1000, 10000].map((rows) => {
    const range = virtualRange(rows, 480, 32, 2000);
    return { rows, window: range.end - range.start };
  });
}
