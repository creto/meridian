import { useMemo, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { applyCalculations, calculationCycles, isVisible, validateForm } from "@/lib/forms/engine";
import { compileExpression } from "@/lib/forms/expressions";
import { lintForm } from "@/lib/forms/lint";
import { sampleSubmission } from "@/lib/forms/pdf-layout";
import { flattenInputs, updateComponent } from "@/lib/forms/tree";
import type { FormComponent, FormDefinition } from "@/lib/forms/types";

export function LogicPane({ form, onComponents }: { form: FormDefinition; onComponents: (components: FormComponent[]) => void }) {
  const fields = flattenInputs(form.components).filter((component) => component.type !== "content" && component.type !== "button" && component.type !== "review");
  const issues = useMemo(() => lintForm(form), [form]);
  const cycles = useMemo(() => calculationCycles(form.components), [form]);
  const [sampleText, setSampleText] = useState(() => JSON.stringify(sampleSubmission(form.components), null, 2));
  const [focus, setFocus] = useState(fields[0]?.id ?? "");
  const selected = fields.find((component) => component.id === focus) ?? fields[0];
  const trial = useMemo(() => {
    try {
      const data = JSON.parse(sampleText) as Record<string, unknown>;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Sample must be an object");
      const computed = applyCalculations(form.components, data);
      const errors = validateForm(form, computed);
      return { data: computed, errors, error: "" };
    } catch (reason) {
      return { data: {}, errors: {}, error: reason instanceof Error ? reason.message : "Invalid sample" };
    }
  }, [sampleText, form]);

  function patch(component: FormComponent, next: Partial<FormComponent>) {
    onComponents(updateComponent(form.components, component.id, next));
  }

  function ruleStatus(source: string | undefined) {
    if (!source?.trim()) return "Not set";
    const compiled = compileExpression(source);
    return compiled.ok ? "Valid expression" : compiled.error;
  }

  return (
    <div className="grid min-h-0 flex-1 bg-paper text-paper-fg lg:grid-cols-[16rem_1fr_18rem]">
      <aside className="grid content-start gap-1 overflow-auto border-r border-line p-3">
        <h2 className="mb-1 text-sm font-semibold">Fields</h2>
        {fields.map((component) => (
          <button key={component.id} type="button" className={`rounded-md px-2 py-2 text-left text-sm ${selected?.id === component.id ? "bg-surface" : ""}`} onClick={() => setFocus(component.id)}>
            {component.label}
            <span className="block text-xs text-muted">{[component.conditional ? "show" : "", component.calculateValue ? "calc" : "", component.validate?.custom ? "valid" : ""].filter(Boolean).join(" · ") || component.key}</span>
          </button>
        ))}
      </aside>
      <div className="grid content-start gap-3 overflow-auto p-4">
        {selected ? (
          <>
            <h2 className="font-semibold">{selected.label}</h2>
            <label className="grid gap-1 text-sm">Show when
              <Input aria-label="Show when" value={selected.conditional ?? ""} placeholder={'status == "open"'} onChange={(event) => patch(selected, { conditional: event.target.value || undefined })} />
              <span className="text-xs text-muted">{ruleStatus(selected.conditional)}</span>
            </label>
            <label className="grid gap-1 text-sm">Calculate
              <Input aria-label="Calculate" value={selected.calculateValue ?? ""} placeholder="quantity * price" onChange={(event) => patch(selected, { calculateValue: event.target.value || undefined })} />
              <span className="text-xs text-muted">{ruleStatus(selected.calculateValue)}</span>
            </label>
            <label className="grid gap-1 text-sm">Valid when
              <Input aria-label="Valid when" value={selected.validate?.custom ?? ""} placeholder="len(value) > 2" onChange={(event) => patch(selected, { validate: { ...selected.validate, custom: event.target.value || undefined } })} />
              <span className="text-xs text-muted">{ruleStatus(selected.validate?.custom)}</span>
            </label>
            <label className="grid gap-1 text-sm">Pattern
              <Input aria-label="Pattern" value={selected.validate?.pattern ?? ""} placeholder="^[A-Z]+$" onChange={(event) => patch(selected, { validate: { ...selected.validate, pattern: event.target.value || undefined } })} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => {
                const other = fields.find((item) => item.id !== selected.id);
                if (other) patch(selected, { conditional: `${other.key} == "yes"` });
              }}>Show when another field is yes</Button>
              <Button variant="ghost" onClick={() => patch(selected, { conditional: undefined, calculateValue: undefined, validate: { ...selected.validate, custom: undefined } })}>Clear rules</Button>
            </div>
          </>
        ) : <p className="text-sm text-muted">This form has no inputs to attach rules to.</p>}
        <h2 className="font-semibold">Checks</h2>
        <ul className="grid gap-1 text-sm">
          {issues.length === 0 ? <li className="text-muted">No quality issues.</li> : null}
          {issues.map((issue, index) => <li key={index} className={issue.level === "error" ? "text-danger" : "text-warn"}>{issue.message}</li>)}
          {cycles.map((cycle) => <li key={cycle.join()} className="text-danger">Calculation cycle: {cycle.join(" → ")}</li>)}
        </ul>
      </div>
      <aside className="grid content-start gap-2 overflow-auto border-l border-line p-3">
        <h2 className="text-sm font-semibold">Try the rules</h2>
        <Textarea aria-label="Sample data" value={sampleText} onChange={(event) => setSampleText(event.target.value)} className="min-h-40 font-mono text-xs" />
        {trial.error ? <p className="text-sm text-danger">{trial.error}</p> : null}
        <Button variant="ghost" onClick={() => setSampleText(JSON.stringify(sampleSubmission(form.components), null, 2))}>Reset sample</Button>
        <ul className="grid gap-2 text-sm">
          {fields.map((component) => {
            const visible = trial.error ? true : isVisible(component, trial.data);
            const value = trial.data[component.key];
            const message = trial.errors[component.key];
            return (
              <li key={component.id} className="rounded-md border border-line px-2 py-2">
                <p className="font-medium">{component.label}</p>
                <p className="text-xs text-muted">{visible ? "Visible" : "Hidden"}{component.calculateValue ? ` · ${String(value ?? "")}` : ""}</p>
                {message ? <p className="text-xs text-danger">{message}</p> : null}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
