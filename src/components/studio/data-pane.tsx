import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui/primitives";
import { downloadBytes, formatValue } from "@/lib/forms/pdf";
import { renderFormPdf } from "@/lib/forms/pdf-layout";
import { inputLabels } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";
import type { FormDefinition, Submission } from "@/lib/forms/types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function csvEscape(value: unknown) {
  return `"${formatValue(value).replaceAll("\"", "\"\"")}"`;
}

export function DataPane({ form }: { form: FormDefinition }) {
  const all = useFormStore((s) => s.submissions);
  const submit = useFormStore((s) => s.submit);
  const removeSubmission = useFormStore((s) => s.removeSubmission);
  const submissions = useMemo(() => all.filter((item) => item.formId === form.id), [all, form.id]);
  const labels = useMemo(() => inputLabels(form), [form]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "status">("newest");
  const [columns, setColumns] = useState<string[]>(() => labels.slice(0, 4).map((item) => item.key));
  const [open, setOpen] = useState<string | null>(null);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of submissions) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [submissions]);
  const rows = submissions
    .filter((item) => status === "all" || item.status === status)
    .filter((item) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return item.id.toLowerCase().includes(needle) || item.status.includes(needle) || JSON.stringify(item.data).toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      if (sort === "status") return a.status.localeCompare(b.status);
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return sort === "oldest" ? left - right : right - left;
    });
  const current = submissions.find((item) => item.id === open) ?? null;
  const shown = labels.filter((item) => columns.includes(item.key));

  function downloadTable(kind: "csv" | "json") {
    if (kind === "json") {
      downloadBytes(new TextEncoder().encode(JSON.stringify(rows, null, 2)), `${form.name}-submissions.json`, "application/json");
      return;
    }
    const header = ["id", "status", "createdAt", ...labels.map((item) => item.key)];
    const lines = [header.join(",")].concat(rows.map((item) => header.map((key) => {
      const value = key === "id" || key === "status" || key === "createdAt" ? item[key as "id" | "status" | "createdAt"] : item.data[key];
      return csvEscape(value);
    }).join(",")));
    downloadBytes(new TextEncoder().encode(lines.join("\n")), `${form.name}.csv`, "text/csv");
  }

  async function downloadPdf(item: Submission) {
    const bytes = await renderFormPdf({
      title: form.title,
      pageCount: form.pdfPages || 1,
      components: form.components,
      data: item.data,
      mode: "filled",
      theme: form.settings.pdf?.theme,
    });
    downloadBytes(bytes, `${form.name}-${item.id}.pdf`);
  }

  async function importCsv(file: File) {
    const table = parseCsv(await file.text());
    const header = table[0]?.map((item) => item.trim()) ?? [];
    const keys = header.filter((key) => labels.some((item) => item.key === key));
    if (!keys.length) {
      toast.error("The CSV needs a header row with field keys");
      return;
    }
    let saved = 0;
    for (const line of table.slice(1, 201)) {
      const data: Record<string, unknown> = {};
      header.forEach((key, index) => {
        if (keys.includes(key)) data[key] = line[index] ?? "";
      });
      const result = await submit({ formId: form.id, data, actor: "import", source: "human", draft: true });
      if (result.ok) saved += 1;
    }
    toast.success(`Imported ${saved} draft${saved === 1 ? "" : "s"}`);
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] bg-paper text-paper-fg">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Input className="max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search id, status, or answer" aria-label="Filter submissions" />
        <select aria-label="Status" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses ({submissions.length})</option>
          {[...counts.entries()].map(([name, count]) => <option key={name} value={name}>{name.replaceAll("_", " ")} ({count})</option>)}
        </select>
        <select aria-label="Sort" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="status">Status</option>
        </select>
        <Button variant="secondary" onClick={() => downloadTable("csv")}>Export CSV</Button>
        <Button variant="secondary" onClick={() => downloadTable("json")}>Export JSON</Button>
        <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-line px-3 text-sm">
          Import CSV
          <input className="hidden" type="file" accept=".csv,text/csv" aria-label="Import CSV" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importCsv(file);
          }} />
        </label>
        <span className="text-xs text-muted">{rows.length} shown</span>
      </div>
      <div className="grid min-h-0 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-auto p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            {labels.map((item) => (
              <label key={item.key} className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={columns.includes(item.key)} onChange={() => setColumns((current) => current.includes(item.key) ? current.filter((key) => key !== item.key) : [...current, item.key])} />
                {item.label}
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">When</th>
                  {shown.map((label) => <th key={label.key} className="px-3 py-2">{label.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td className="px-3 py-6 text-muted" colSpan={2 + shown.length}>No submissions match.</td></tr> : null}
                {rows.map((item) => (
                  <tr key={item.id} className={`cursor-pointer border-t border-line ${open === item.id ? "bg-paper" : ""}`} onClick={() => setOpen(item.id)}>
                    <td className="px-3 py-3">{item.status.replaceAll("_", " ")}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                    {shown.map((label) => <td key={label.key} className="max-w-48 truncate px-3 py-3">{formatValue(item.data[label.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="grid content-start gap-3 overflow-auto border-l border-line p-3">
          {current ? (
            <>
              <div>
                <p className="text-xs text-muted">{current.id}</p>
                <h2 className="font-semibold">{current.status.replaceAll("_", " ")}</h2>
              </div>
              <dl className="grid gap-2">
                {labels.map((label) => (
                  <div key={label.key}>
                    <dt className="text-xs text-muted">{label.label}</dt>
                    <dd className="text-sm">{formatValue(current.data[label.key])}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void downloadPdf(current)}>Download PDF</Button>
                <Button variant="secondary" onClick={() => {
                  void navigator.clipboard.writeText(JSON.stringify(current.data, null, 2));
                  toast.success("Copied submission JSON");
                }}>Copy JSON</Button>
                <Button variant="danger" onClick={() => { removeSubmission(current.id); setOpen(null); }}>Delete</Button>
              </div>
              {current.workflow ? <pre className="overflow-auto rounded-md bg-chrome p-2 font-mono text-xs text-chrome-fg">{JSON.stringify(current.workflow, null, 2)}</pre> : null}
            </>
          ) : <p className="text-sm text-muted">Select a row to read it, download its PDF, or delete it. CSV import matches header names to field keys and saves drafts.</p>}
        </aside>
      </div>
    </div>
  );
}
