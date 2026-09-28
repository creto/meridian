import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/shell";
import { Badge, Button, FieldLabel, Input, Modal, Textarea } from "@/components/ui/primitives";
import { generateFormWithModel } from "@/lib/forms/ai.functions";
import { generateFormFromText } from "@/lib/forms/generate";
import { detectJsonImport, newFormShell, parseCsv, profileColumns, componentsFromProfiles, componentsFromFieldTable, looksLikeFieldTable } from "@/lib/forms/importing";
import { importWorkbook, type SheetSummary } from "@/lib/forms/spreadsheet";
import { useFormStore } from "@/lib/forms/store";
import { TEMPLATES, templateById } from "@/lib/forms/templates";
import { flattenInputs } from "@/lib/forms/tree";
import { uid } from "@/lib/forms/ids";

const PROMPTS = [
  "Necesito un formulario para registrar proveedores. Si es una empresa colombiana necesito NIT, razón social, representante legal, RUT y certificado bancario. Si es extranjera necesito Tax ID. Quiero que compras revise primero y después finanzas. Al aprobarse guarde el PDF final en nuestro ECM.",
  "Employee onboarding with legal name, email, department, start date, and a laptop request.",
  "Incident report with time, location, severity, description, and a photo.",
];

export function Dashboard() {
  const forms = useFormStore((s) => s.forms);
  const submissions = useFormStore((s) => s.submissions);
  const workspace = useFormStore((s) => s.workspaceName);
  const [query, setQuery] = useState("");

  const visible = forms.filter((form) => {
    const q = query.trim().toLowerCase();
    if (!q) return form.status !== "archived";
    return [form.title, form.description, form.name, ...form.tags].join(" ").toLowerCase().includes(q);
  });

  const stats = [
    { label: "Published", value: forms.filter((f) => f.status === "published").length },
    { label: "Drafts", value: forms.filter((f) => f.status === "draft").length },
    { label: "Submissions", value: submissions.length },
    { label: "Waiting", value: submissions.filter((s) => s.status === "in_review").length },
  ];
  const chart = useMemo(() => {
    const order = ["submitted", "in_review", "changes_requested", "approved", "rejected", "draft"] as const;
    return order.map((status) => ({ status: status.replace("_", " "), count: submissions.filter((s) => s.status === status).length }));
  }, [submissions]);
  const chartMax = Math.max(1, ...chart.map((row) => row.count));

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{workspace}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Forms</h1>
          </div>
          <Input className="max-w-xs" placeholder="Search title, tag, or field" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search forms" />
        </div>
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="mb-2 text-sm text-muted">Submissions by status</p>
            <div className="grid gap-1.5">
              {chart.map((row) => (
                <div key={row.status} className="grid grid-cols-[7.25rem_1fr_1.25rem] items-center gap-2 text-xs">
                  <span className="truncate capitalize text-muted">{row.status}</span>
                  <span className="h-2 overflow-hidden rounded-sm bg-paper">
                    <span className="block h-full rounded-sm bg-accent" style={{ width: `${(row.count / chartMax) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="grid gap-3">
          {visible.length === 0 ? <p className="rounded-xl border border-dashed border-line-strong p-8 text-sm text-muted">No forms match. Create one from a description, a template, or a spreadsheet.</p> : null}
          {visible.map((form) => {
            const count = submissions.filter((s) => s.formId === form.id).length;
            return (
              <article key={form.id} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{form.title}</h2>
                    <Badge tone={form.status === "published" ? "ok" : form.status === "archived" ? "warn" : "neutral"}>{form.status}</Badge>
                    {form.hasUnpublishedChanges && form.status === "published" ? <Badge tone="warn">unpublished edits</Badge> : null}
                    <span className="font-mono text-xs text-subtle">v{form.version}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{form.description || "No description"}</p>
                  <p className="mt-2 text-xs text-subtle">
                    {flattenInputs(form.components).length} fields · {form.display} · {count} submissions
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/studio/$formId" params={{ formId: form.id }} className="inline-flex h-11 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg">
                    Edit
                  </Link>
                  <Link to="/fill/$formId" params={{ formId: form.id }} className="inline-flex h-11 items-center rounded-md border border-line bg-elevated px-3 text-sm">
                    Fill
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export function CreateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (form: ReturnType<typeof newFormShell>) => void;
}) {
  const [tab, setTab] = useState<"describe" | "template" | "import" | "blank">("describe");
  const [prompt, setPrompt] = useState(PROMPTS[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Untitled form");
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [sheetPreview, setSheetPreview] = useState<{ name: string; buffer: ArrayBuffer; sheets: SheetSummary[] } | null>(null);

  const describe = async (provider: "auto" | "local") => {
    setBusy(true);
    try {
      if (provider === "local") {
        onCreate(generateFormFromText(prompt));
        toast.success("Form drafted on this device");
        return;
      }
      const result = await generateFormWithModel({ data: { prompt } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onCreate(result.form);
      toast.success(result.provider === "grok" ? "Drafted with Grok" : "Live model unavailable — drafted on this device");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate");
    } finally {
      setBusy(false);
    }
  };

  const importText = () => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    try {
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const detected = detectJsonImport(JSON.parse(trimmed));
        if (detected.components.length === 0) {
          setNote("Nothing mappable was found in that JSON.");
          return;
        }
        const report = detected.report;
        onCreate(newFormShell({
          title: detected.title || "Imported form",
          display: detected.display,
          components: detected.components,
          source: detected.kind,
          description: report ? `Imported ${report.imported}. Compatible ${report.compatible}. Review ${report.review}. Unsupported ${report.unsupported.length}.` : `Imported from ${detected.kind}.`,
        }));
        toast.success("Import ready in the builder");
        return;
      }
      const parsed = parseCsv(trimmed);
      const components = looksLikeFieldTable(parsed.headers) ? componentsFromFieldTable(parsed.rows) : componentsFromProfiles(profileColumns(parsed.rows));
      if (!components.length) {
        setNote("No columns detected.");
        return;
      }
      onCreate(newFormShell({ title: "Imported sheet", components, source: "csv", description: "Types were inferred from the column values. Review them before publishing." }));
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not parse that file");
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New form" description="Start from language, a template, a file, or an empty canvas.">
      <div className="mb-4 flex gap-1 overflow-x-auto" role="tablist">
        {(["describe", "template", "import", "blank"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={`h-10 shrink-0 rounded-md px-3 text-sm capitalize ${tab === item ? "bg-accent text-accent-fg" : "bg-paper"}`} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "describe" ? (
        <div className="grid gap-3">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Form description" />
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((item) => (
              <button key={item.slice(0, 24)} type="button" className="rounded-md border border-line px-2 py-1 text-left text-xs text-muted" onClick={() => setPrompt(item)}>
                {item.slice(0, 42)}…
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void describe("auto")}>{busy ? "Drafting…" : "Generate"}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => void describe("local")}>Use on-device designer</Button>
          </div>
        </div>
      ) : null}
      {tab === "template" ? (
        <ul className="grid gap-2">
          {TEMPLATES.map((item) => (
            <li key={item.id}>
              <button type="button" className="flex w-full flex-col rounded-lg border border-line px-3 py-3 text-left hover:bg-paper" onClick={() => {
                const form = templateById(item.id);
                if (form) onCreate({ ...form, id: uid("frm") });
              }}>
                <span className="font-medium">{item.title}</span>
                <span className="text-sm text-muted">{item.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "import" ? (
        <div className="grid gap-3">
          <FieldLabel hint="JSON, JSON Schema, CSV, or Excel">Paste or upload</FieldLabel>
          <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='{"components":[]} or Name,Email,Phone' aria-label="Import source" />
          <input
            type="file"
            accept=".json,.csv,.txt,.xlsx,.xls,application/json,text/csv"
            className="text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (/\.xlsx?$/.test(file.name)) {
                const buffer = await file.arrayBuffer();
                const result = await importWorkbook(buffer);
                if (result.sheetCount > 1) {
                  setSheetPreview({ name: file.name, buffer, sheets: result.sheets });
                  setNote(result.warnings.join(" "));
                  return;
                }
                if (!result.components.length) {
                  setNote("No fields inferred.");
                  return;
                }
                onCreate(newFormShell({
                  title: file.name.replace(/\.\w+$/, ""),
                  components: result.components,
                  source: "excel",
                  description: `${result.mode === "field-table" ? "Field table" : "Profiled columns"} from ${result.sheetName}. ${result.warnings.join(" ")}`,
                }));
                return;
              }
              setRaw(await file.text());
            }}
          />
          {sheetPreview && sheetPreview.sheets.length > 1 ? (
            <div className="grid gap-2">
              <p className="text-sm">Choose a sheet. Other sheets stay in the workbook and are not imported.</p>
              {sheetPreview.sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  type="button"
                  className="rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-paper"
                  onClick={() => {
                    void importWorkbook(sheetPreview.buffer, sheet.name).then((result) => {
                      if (!result.components.length) {
                        setNote(`No fields inferred from ${sheet.name}.`);
                        return;
                      }
                      onCreate(newFormShell({
                        title: sheetPreview.name.replace(/\.\w+$/, ""),
                        components: result.components,
                        source: "excel",
                        description: `${result.mode === "field-table" ? "Field table" : "Profiled columns"} from ${result.sheetName}. ${result.warnings.join(" ")}`,
                      }));
                    });
                  }}
                >
                  <span className="font-medium">{sheet.name}</span>
                  <span className="ml-2 text-muted">{sheet.rows} rows · {sheet.columns} columns</span>
                </button>
              ))}
            </div>
          ) : null}
          {note ? <p className="text-sm text-danger">{note}</p> : null}
          <Button onClick={importText}>Create from text</Button>
        </div>
      ) : null}
      {tab === "blank" ? (
        <div className="grid gap-3">
          <FieldLabel>Title</FieldLabel>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Form title" />
          <Button onClick={() => onCreate(newFormShell({ title: title || "Untitled form", components: [], source: "blank" }))}>Create blank form</Button>
        </div>
      ) : null}
    </Modal>
  );
}
