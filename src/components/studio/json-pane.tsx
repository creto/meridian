import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Textarea } from "@/components/ui/primitives";
import { semanticDiff } from "@/lib/forms/diff";
import { lintForm } from "@/lib/forms/lint";
import { downloadBytes } from "@/lib/forms/pdf";
import type { FormComponent, FormDefinition } from "@/lib/forms/types";

const KNOWN = new Set<string>([
  "textfield", "textarea", "number", "password", "email", "phone", "url", "hidden", "select", "radio", "checkbox", "selectboxes", "toggle", "datetime", "date", "time", "currency", "slider", "rating", "content", "panel", "columns", "fieldset", "tabs", "datagrid", "container", "file", "signature", "address", "captcha", "button", "review",
]);

function snapshot(form: FormDefinition) {
  return { title: form.title, name: form.name, display: form.display, components: form.components, workflow: form.workflow, settings: form.settings };
}

function walkTypes(components: unknown, issues: string[]) {
  if (!Array.isArray(components)) return;
  for (const item of components) {
    if (!item || typeof item !== "object") {
      issues.push("A component is not an object");
      continue;
    }
    const component = item as FormComponent;
    if (!KNOWN.has(component.type)) issues.push(`Unknown type “${String(component.type)}” on ${component.key || component.label || "a component"}`);
    if (component.type !== "content" && component.type !== "button" && !component.key) issues.push(`${component.label || component.type} is missing a key`);
    if (component.components) walkTypes(component.components, issues);
    component.columns?.forEach((column) => walkTypes(column.components, issues));
  }
}

export function JsonPane({ form, onApply }: { form: FormDefinition; onApply: (parsed: Partial<FormDefinition>) => void }) {
  const [text, setText] = useState(() => JSON.stringify(snapshot(form), null, 2));
  const [error, setError] = useState("");
  const report = useMemo(() => {
    try {
      const parsed = JSON.parse(text) as Partial<FormDefinition>;
      const issues: string[] = [];
      if (!Array.isArray(parsed.components)) issues.push("JSON needs a components array");
      else walkTypes(parsed.components, issues);
      const lint = Array.isArray(parsed.components)
        ? lintForm({ ...form, components: parsed.components as FormComponent[], display: parsed.display === "wizard" ? "wizard" : form.display, title: typeof parsed.title === "string" ? parsed.title : form.title })
        : [];
      const diff = Array.isArray(parsed.components) ? semanticDiff(form.components, parsed.components as FormComponent[]) : null;
      return { parsed, issues, lint, diff, ok: issues.length === 0 && !lint.some((item) => item.level === "error") };
    } catch (reason) {
      return { parsed: null, issues: [reason instanceof Error ? reason.message : "Invalid JSON"], lint: [], diff: null, ok: false };
    }
  }, [text, form]);

  function apply() {
    if (!report.parsed || !Array.isArray(report.parsed.components)) {
      setError(report.issues[0] || "JSON needs a components array");
      return;
    }
    if (report.lint.some((item) => item.level === "error")) {
      setError("Fix the errors before applying");
      return;
    }
    onApply(report.parsed);
    setError("");
    toast.success("Builder updated from JSON");
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] bg-paper text-paper-fg lg:grid-cols-[1fr_18rem] lg:grid-rows-1">
      <div className="flex min-h-0 flex-col p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <Button onClick={apply} disabled={!report.ok}>Apply to builder</Button>
          <Button variant="secondary" onClick={() => { try { setText(JSON.stringify(JSON.parse(text), null, 2)); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid JSON"); } }}>Format</Button>
          <Button variant="secondary" onClick={() => { try { setText(JSON.stringify(JSON.parse(text))); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid JSON"); } }}>Minify</Button>
          <Button variant="secondary" onClick={() => { setText(JSON.stringify(snapshot(form), null, 2)); setError(""); }}>Reload</Button>
          <Button variant="ghost" onClick={() => downloadBytes(new TextEncoder().encode(text), `${form.name}.json`, "application/json")}>Download</Button>
          <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(text); toast.success("Copied"); }}>Copy</Button>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-line px-3 text-sm">
            Open file
            <input className="hidden" type="file" accept="application/json,.json" aria-label="Open form JSON" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then((next) => { setText(next); setError(""); });
            }} />
          </label>
        </div>
        {error ? <p role="alert" className="mb-2 text-sm text-danger">{error}</p> : null}
        <Textarea value={text} onChange={(event) => { setText(event.target.value); setError(""); }} className="min-h-0 flex-1 font-mono text-xs" spellCheck={false} aria-label="Form JSON" />
      </div>
      <aside className="grid content-start gap-3 overflow-auto border-l border-line p-3">
        <h2 className="text-sm font-semibold">Check</h2>
        {report.issues.length === 0 && report.lint.length === 0 ? <p className="text-sm text-muted">JSON parses and the form checks pass.</p> : null}
        <ul className="grid gap-1 text-sm">
          {report.issues.map((item) => <li key={item} className="text-danger">{item}</li>)}
          {report.lint.map((item, index) => <li key={index} className={item.level === "error" ? "text-danger" : "text-warn"}>{item.level}: {item.message}</li>)}
        </ul>
        <h2 className="text-sm font-semibold">Diff against the builder</h2>
        {report.diff ? (
          <ul className="grid gap-1 text-xs">
            {report.diff.added.length + report.diff.removed.length + report.diff.changed.length === 0 ? <li className="text-muted">No component changes.</li> : null}
            {report.diff.added.map((item) => <li key={item}>Add {item}</li>)}
            {report.diff.removed.map((item) => <li key={item}>Remove {item}</li>)}
            {report.diff.changed.map((item) => <li key={item}>Change {item}</li>)}
          </ul>
        ) : <p className="text-sm text-muted">Fix the JSON to see a diff.</p>}
        <p className="text-xs text-muted">Types must be one of the builder types ({KNOWN.size}). Apply refuses documents that fail the error checks.</p>
      </aside>
    </div>
  );
}
