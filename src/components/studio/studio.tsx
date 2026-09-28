import { Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { FormRuntime } from "@/components/forms/runtime";
import { Mark } from "@/components/shell";
import { Badge, Button, Input, Modal, Textarea } from "@/components/ui/primitives";
import { proposeEdit } from "@/lib/forms/assistant";
import { CATALOG, createComponent, GROUPS } from "@/lib/forms/catalog";
import { semanticDiff } from "@/lib/forms/diff";
import { lintForm } from "@/lib/forms/lint";
import { toCapabilities, toJsonSchema, inputLabels } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";
import { cloneComponentTree, collectKeys, duplicateComponent, findComponent, flattenInputs, insertComponent, insertIntoColumn, moveComponent, removeComponent, updateComponent } from "@/lib/forms/tree";
import { uniqueKey, uid } from "@/lib/forms/ids";
import type { ComponentType, FormComponent, FormDefinition } from "@/lib/forms/types";
import { cn } from "@/lib/cn";

const MODES = ["Build", "Preview", "Data", "JSON", "Logic", "API", "PDF", "Flow"] as const;
type Mode = (typeof MODES)[number];

let clipboard: FormComponent | null = null;

function Icon({ name }: { name: string }) {
  const map = Icons as unknown as Record<string, Icons.LucideIcon | undefined>;
  const Cmp = map[name] ?? Icons.Square;
  return <Cmp className="size-4" />;
}

function typingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

export function Studio({ formId }: { formId: string }) {
  const form = useFormStore((s) => s.forms.find((item) => item.id === formId));
  const updateForm = useFormStore((s) => s.updateForm);
  const publishForm = useFormStore((s) => s.publishForm);
  const restoreVersion = useFormStore((s) => s.restoreVersion);
  const duplicateForm = useFormStore((s) => s.duplicateForm);
  const setPalette = useFormStore((s) => s.setPalette);
  const submit = useFormStore((s) => s.submit);
  const actor = useFormStore((s) => s.actorName);
  const [mode, setMode] = useState<Mode>("Build");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<"canvas" | "fields" | "props">("canvas");
  const [past, setPast] = useState<FormComponent[][]>([]);
  const [future, setFuture] = useState<FormComponent[][]>([]);
  const [device, setDevice] = useState<"full" | "tablet" | "phone">("full");
  const [ink, setInk] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<ReturnType<typeof proposeEdit> | null>(null);
  const [diffVersion, setDiffVersion] = useState<number | null>(null);

  const issues = useMemo(() => (form ? lintForm(form) : []), [form]);

  useEffect(() => {
    if (!form) return;
    setPalette([
      { id: "preview", label: "Preview form", run: () => setMode("Preview") },
      { id: "json", label: "Open JSON", run: () => setMode("JSON") },
      { id: "publish", label: "Publish", run: () => setPublishOpen(true) },
      { id: "versions", label: "Version history", run: () => setVersionsOpen(true) },
      { id: "assist", label: "Open assistant", run: () => setAssistOpen(true) },
    ]);
    return () => setPalette([]);
  }, [form, setPalette]);

  useEffect(() => {
    if (mode === "JSON" && form) {
      setJsonText(JSON.stringify({ title: form.title, name: form.name, display: form.display, components: form.components, workflow: form.workflow, settings: form.settings }, null, 2));
      setJsonError("");
    }
  }, [mode, form]);

  function commit(next: FormComponent[]) {
    if (!form) return;
    setPast((stack) => [...stack, form.components].slice(-40));
    setFuture([]);
    updateForm(form.id, (current) => ({ ...current, components: next }));
  }

  function patchMeta(patch: Partial<FormDefinition>, message?: string) {
    if (!form) return;
    updateForm(form.id, (current) => ({ ...current, ...patch }), message);
  }

  function addType(type: ComponentType, parentId?: string | null) {
    if (!form) return;
    const taken = new Set(collectKeys(form.components));
    const item = CATALOG.find((entry) => entry.type === type);
    const key = uniqueKey(item?.label ?? type, taken);
    const component = createComponent(type, key);
    component.key = key;
    const parent = parentId ? findComponent(form.components, parentId)?.component : selected.length === 1 ? findComponent(form.components, selected[0]!)?.component : null;
    const container = parent && ["panel", "fieldset", "tabs", "container", "datagrid"].includes(parent.type) ? parent.id : null;
    commit(insertComponent(form.components, component, container, 999));
    setSelected([component.id]);
    setPane("props");
  }

  function patchSelected(patch: Partial<FormComponent>) {
    if (!form || selected.length !== 1) return;
    commit(updateComponent(form.components, selected[0]!, patch));
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!form || typingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const next = future[future.length - 1];
          if (!next) return;
          setFuture((stack) => stack.slice(0, -1));
          setPast((stack) => [...stack, form.components]);
          updateForm(form.id, (current) => ({ ...current, components: next }));
        } else {
          const prev = past[past.length - 1];
          if (!prev) return;
          setPast((stack) => stack.slice(0, -1));
          setFuture((stack) => [...stack, form.components]);
          updateForm(form.id, (current) => ({ ...current, components: prev }));
        }
      } else if (mod && event.key.toLowerCase() === "d" && selected[0]) {
        event.preventDefault();
        duplicate(selected[0]);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selected.length) {
        event.preventDefault();
        let next = form.components;
        for (const id of selected) next = removeComponent(next, id);
        commit(next);
        setSelected([]);
      } else if (mod && event.key.toLowerCase() === "c" && selected[0]) {
        const loc = findComponent(form.components, selected[0]);
        if (loc) clipboard = structuredClone(loc.component);
      } else if (mod && event.key.toLowerCase() === "v" && clipboard) {
        const taken = new Set(collectKeys(form.components));
        const copy = cloneComponentTree(clipboard, () => uid("cmp"), (key) => uniqueKey(key, taken));
        commit(insertComponent(form.components, copy, null, 999));
        setSelected([copy.id]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function duplicate(id: string) {
    if (!form) return;
    const loc = findComponent(form.components, id);
    if (!loc) return;
    const taken = new Set(collectKeys(form.components));
    const copy = cloneComponentTree(loc.component, () => uid("cmp"), (key) => uniqueKey(key, taken));
    commit(duplicateComponent(form.components, id, copy));
    setSelected([copy.id]);
  }

  if (!form) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">This form is not in the workspace</h1>
          <Link to="/" className="mt-4 inline-flex h-11 items-center text-sm underline">Back to forms</Link>
        </div>
      </div>
    );
  }

  const selectedComponent = selected.length === 1 ? findComponent(form.components, selected[0]!)?.component ?? null : null;
  const filtered = CATALOG.filter((item) => `${item.label} ${item.type} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()));

  const onDrop = (event: DragEvent, parentId: string | null, column?: number) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer.getData("application/x-meridian");
    if (!raw) return;
    const payload = JSON.parse(raw) as { op: "new"; type: ComponentType } | { op: "move"; id: string };
    if (payload.op === "new") {
      const taken = new Set(collectKeys(form.components));
      const key = uniqueKey(payload.type, taken);
      const component = createComponent(payload.type, key);
      component.key = key;
      const next = column != null && parentId
        ? insertIntoColumn(form.components, parentId, column, component, 999)
        : insertComponent(form.components, component, parentId, 999);
      commit(next);
      setSelected([component.id]);
      return;
    }
    const loc = findComponent(form.components, payload.id);
    if (!loc) return;
    if (parentId && (parentId === payload.id)) return;
    let next = removeComponent(form.components, payload.id);
    next = column != null && parentId
      ? insertIntoColumn(next, parentId, column, loc.component, 999)
      : insertComponent(next, loc.component, parentId, 999);
    commit(next);
  };

  return (
    <div className="flex h-screen flex-col bg-chrome text-chrome-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-chrome-line px-3">
        <Link to="/" aria-label="All forms" className="text-chrome-fg"><Mark className="size-6" /></Link>
        <input
          value={form.title}
          aria-label="Form title"
          onChange={(event) => patchMeta({ title: event.target.value })}
          className="w-40 min-w-0 bg-transparent text-sm font-medium outline-none sm:w-64"
        />
        <Badge tone={form.status === "published" ? "ok" : "neutral"}>{form.status}</Badge>
        <span className="hidden font-mono text-xs text-chrome-muted sm:inline">v{form.version}</span>
        <div className="ml-auto hidden items-center gap-1 lg:flex">
          {MODES.map((item) => (
            <button key={item} type="button" className={cn("h-9 rounded-md px-2.5 text-sm", mode === item ? "bg-chrome-elev text-chrome-fg" : "text-chrome-muted")} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
        <label className="lg:hidden">
          <span className="sr-only">Mode</span>
          <select className="h-10 rounded-md bg-chrome-elev px-2 text-sm" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            {MODES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <Button variant="ghost" className="h-10 text-chrome-fg hover:bg-white/10" onClick={() => setAssistOpen(true)}>Assist</Button>
        <Button variant="secondary" className="h-10" onClick={() => setPublishOpen(true)}>Publish</Button>
      </header>

      {mode === "Build" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex border-b border-chrome-line lg:hidden">
            {(["canvas", "fields", "props"] as const).map((item) => (
              <button key={item} type="button" className={cn("h-11 flex-1 text-sm capitalize", pane === item && "bg-chrome-elev")} onClick={() => setPane(item)}>{item}</button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
            <aside className={cn("min-h-0 overflow-auto border-chrome-line lg:border-r", pane !== "fields" && "hidden lg:block")}>
              <div className="p-3">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a component" aria-label="Find a component" className="border-chrome-line bg-chrome-elev text-chrome-fg" />
              </div>
              {GROUPS.map((group) => {
                const items = filtered.filter((item) => item.group === group);
                if (!items.length) return null;
                return (
                  <div key={group} className="px-2 pb-3">
                    <p className="px-2 pb-1 text-xs text-chrome-muted">{group}</p>
                    <div className="grid gap-1">
                      {items.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("application/x-meridian", JSON.stringify({ op: "new", type: item.type }))}
                          onClick={() => addType(item.type)}
                          className="flex h-11 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-chrome-elev"
                        >
                          <Icon name={item.icon} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-chrome-line p-3">
                <p className="mb-2 text-xs text-chrome-muted">Structure</p>
                <Tree nodes={form.components} selected={selected} onSelect={(id, shift) => setSelected((curr) => shift ? (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]) : [id])} />
              </div>
            </aside>
            <main
              className={cn("min-h-0 overflow-auto bg-paper text-paper-fg", pane !== "canvas" && "hidden lg:block")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, null)}
            >
              <div className="mx-auto grid max-w-3xl gap-3 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>{form.display === "wizard" ? "Wizard" : "Single page"}</span>
                  <button type="button" className="underline" onClick={() => patchMeta({ display: form.display === "wizard" ? "form" : "wizard" }, form.display === "wizard" ? "Switched to a single page" : "Switched to a wizard")}>
                    Switch
                  </button>
                  <span className="ml-auto flex gap-1">
                    <Button variant="ghost" className="h-9" onClick={() => { const prev = past[past.length - 1]; if (!prev) return; setPast((s) => s.slice(0, -1)); setFuture((s) => [...s, form.components]); updateForm(form.id, (c) => ({ ...c, components: prev })); }} disabled={!past.length}>Undo</Button>
                    <Button variant="ghost" className="h-9" onClick={() => { const next = future[future.length - 1]; if (!next) return; setFuture((s) => s.slice(0, -1)); setPast((s) => [...s, form.components]); updateForm(form.id, (c) => ({ ...c, components: next })); }} disabled={!future.length}>Redo</Button>
                  </span>
                </div>
                {form.components.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line-strong p-10 text-center text-sm text-muted">
                    Add a field from the palette, or describe the form with Assist.
                  </div>
                ) : (
                  form.components.map((component) => (
                    <BuilderNode
                      key={component.id}
                      component={component}
                      selected={selected}
                      onSelect={(id, shift) => {
                        setSelected((curr) => (shift ? (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]) : [id]));
                        setPane("props");
                      }}
                      onDrop={onDrop}
                      onDelete={(id) => { commit(removeComponent(form.components, id)); setSelected([]); }}
                      onMove={(id, dir) => commit(moveComponent(form.components, id, dir))}
                      onDuplicate={duplicate}
                    />
                  ))
                )}
              </div>
            </main>
            <aside className={cn("min-h-0 overflow-auto border-chrome-line bg-chrome lg:border-l", pane !== "props" && "hidden lg:block")}>
              <Inspector
                form={form}
                component={selectedComponent}
                count={selected.length}
                onPatch={patchSelected}
                onForm={(patch) => patchMeta(patch)}
                onBulk={(patch) => {
                  let next = form.components;
                  for (const id of selected) next = updateComponent(next, id, patch);
                  commit(next);
                }}
              />
            </aside>
          </div>
        </div>
      ) : null}

      {mode === "Preview" ? (
        <div className={cn("flex min-h-0 flex-1 flex-col", ink && "theme-ink")}>
          <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-center gap-2 p-4">
            {(["full", "tablet", "phone"] as const).map((item) => (
              <Button key={item} variant={device === item ? "primary" : "secondary"} className="h-10 capitalize" onClick={() => setDevice(item)}>{item}</Button>
            ))}
            <Button variant="secondary" className="h-10" onClick={() => setInk((v) => !v)}>{ink ? "Paper" : "Ink"}</Button>
            <Link to="/fill/$formId" params={{ formId: form.id }} className="ml-auto text-sm underline">Open fill page</Link>
          </div>
          <div className="min-h-0 flex-1 bg-paper px-4 text-paper-fg">
            <FormRuntime
              form={form}
              frame={device}
              onSubmit={async (data) => {
                const result = await submit({ formId: form.id, data, actor, source: "human" });
                if (!result.ok) return { errors: result.errors, message: result.message };
                toast.success("Submission stored");
                return { message: form.settings.successMessage };
              }}
              onDraft={(data) => {
                void submit({ formId: form.id, data, actor, draft: true });
                toast.success("Draft saved in this workspace");
              }}
            />
          </div>
        </div>
      ) : null}

      {mode === "Data" ? <DataPane form={form} /> : null}

      {mode === "JSON" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-paper p-4 text-paper-fg">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button onClick={() => {
              try {
                const parsed = JSON.parse(jsonText) as Partial<FormDefinition>;
                if (!Array.isArray(parsed.components)) {
                  setJsonError("JSON needs a components array");
                  return;
                }
                updateForm(form.id, (current) => ({
                  ...current,
                  title: typeof parsed.title === "string" ? parsed.title : current.title,
                  display: parsed.display === "wizard" ? "wizard" : parsed.display === "form" ? "form" : current.display,
                  components: parsed.components as FormComponent[],
                  workflow: parsed.workflow ?? current.workflow,
                  settings: parsed.settings ? { ...current.settings, ...parsed.settings } : current.settings,
                }), "Updated from JSON");
                setJsonError("");
                toast.success("Builder updated from JSON");
              } catch (error) {
                setJsonError(error instanceof Error ? error.message : "Invalid JSON");
              }
            }}>Apply to builder</Button>
            <Button variant="secondary" onClick={() => {
              setJsonText(JSON.stringify({ title: form.title, name: form.name, display: form.display, components: form.components, workflow: form.workflow, settings: form.settings }, null, 2));
              setJsonError("");
            }}>Format</Button>
          </div>
          {jsonError ? <p role="alert" className="mb-2 text-sm text-danger">{jsonError}</p> : null}
          <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} className="min-h-[70vh] font-mono text-xs" spellCheck={false} aria-label="Form JSON" />
        </div>
      ) : null}

      {mode === "Logic" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-paper p-4 text-paper-fg">
          <div className="mx-auto grid max-w-3xl gap-4">
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="font-semibold">Quality checks</h2>
              <ul className="mt-3 grid gap-2">
                {issues.length === 0 ? <li className="text-sm text-muted">No issues.</li> : null}
                {issues.map((issue, index) => (
                  <li key={index} className={cn("rounded-md px-3 py-2 text-sm", issue.level === "error" ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn")}>
                    {issue.level === "error" ? "Error" : "Warning"} · {issue.message}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="font-semibold">Rules</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {flattenInputs(form.components).filter((c) => c.conditional || c.calculateValue || c.validate?.custom).map((c) => (
                  <li key={c.id} className="rounded-md border border-line px-3 py-2 font-mono text-xs">
                    <span className="font-sans text-sm font-medium">{c.label}</span>
                    {c.conditional ? <p>show when {c.conditional}</p> : null}
                    {c.calculateValue ? <p>= {c.calculateValue}</p> : null}
                    {c.validate?.custom ? <p>valid when {c.validate.custom}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {mode === "API" ? <ApiPane form={form} /> : null}
      {mode === "PDF" ? <PdfPane form={form} onMove={(id, pdf) => { commit(updateComponent(form.components, id, { pdf })); }} /> : null}
      {mode === "Flow" ? (
        <FlowPane
          form={form}
          onChange={(workflow) => patchMeta({ workflow }, "Updated workflow")}
        />
      ) : null}

      <Modal open={publishOpen} onOpenChange={setPublishOpen} title="Publish" description="Errors block publishing. Warnings stay visible and do not stop you.">
        <ul className="mb-4 grid gap-2">
          {issues.length === 0 ? <li className="text-sm text-muted">Checks passed.</li> : null}
          {issues.map((issue, index) => (
            <li key={index} className={cn("rounded-md px-3 py-2 text-sm", issue.level === "error" ? "bg-danger-bg" : "bg-warn-bg")}>{issue.message}</li>
          ))}
        </ul>
        <Button onClick={() => {
          const result = publishForm(form.id, "Published from the studio");
          if (!result.ok) {
            toast.error("Resolve the errors before publishing");
            return;
          }
          toast.success("Published");
          setPublishOpen(false);
        }}>Publish snapshot</Button>
      </Modal>

      <Modal open={versionsOpen} onOpenChange={setVersionsOpen} title="Versions" description="Published snapshots stay immutable. Restore copies one into the draft.">
        <ul className="grid gap-2">
          {[...form.versions].reverse().map((version) => (
            <li key={version.version} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Version {version.version}</span>
                <span className="text-xs text-muted">{new Date(version.savedAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted">{version.note}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" className="h-9" onClick={() => setDiffVersion(version.version)}>Diff with current</Button>
                <Button variant="ghost" className="h-9" onClick={() => { restoreVersion(form.id, version.version); toast.success(`Version ${version.version} restored as draft changes`); }}>Restore</Button>
              </div>
              {diffVersion === version.version ? <DiffBlock before={version.components} after={form.components} /> : null}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-medium">Activity</h3>
        <ul className="mt-2 grid gap-1 text-sm text-muted">
          {form.activity.map((event, index) => (
            <li key={index}>{new Date(event.at).toLocaleString()} — {event.actor} {event.message}</li>
          ))}
        </ul>
      </Modal>

      <Modal open={assistOpen} onOpenChange={setAssistOpen} title="Assistant" description="Changes are proposed as a patch. Nothing is applied until you confirm.">
        <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Make address optional" aria-label="Instruction" />
        <div className="mt-3 flex gap-2">
          <Button onClick={() => setProposal(proposeEdit(form, instruction))}>Propose</Button>
        </div>
        {proposal ? (
          <div className="mt-4 grid gap-2">
            {proposal.summary.map((line) => <p key={line} className="text-sm">+ {line}</p>)}
            {proposal.issues.map((line) => <p key={line} className="text-sm text-warn">{line}</p>)}
            <Button disabled={!proposal.valid} onClick={() => {
              const next = proposal.apply(form);
              updateForm(form.id, () => next);
              toast.success("Patch applied");
              setProposal(null);
              setAssistOpen(false);
            }}>Apply</Button>
          </div>
        ) : null}
      </Modal>
      <button type="button" className="sr-only" onClick={() => setVersionsOpen(true)}>Versions</button>
    </div>
  );
}

function DiffBlock({ before, after }: { before: FormComponent[]; after: FormComponent[] }) {
  const diff = semanticDiff(before, after);
  return (
    <div className="mt-2 grid gap-1 font-mono text-xs">
      {diff.added.map((line) => <p key={line}>+ {line}</p>)}
      {diff.removed.map((line) => <p key={line}>− {line}</p>)}
      {diff.changed.map((line) => <p key={line}>~ {line}</p>)}
      {diff.added.length + diff.removed.length + diff.changed.length === 0 ? <p>No semantic changes.</p> : null}
    </div>
  );
}

function Tree({ nodes, selected, onSelect, depth = 0 }: { nodes: FormComponent[]; selected: string[]; onSelect: (id: string, shift: boolean) => void; depth?: number }) {
  return (
    <ul className="grid gap-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <button type="button" className={cn("flex h-9 w-full items-center rounded-md pr-2 text-left text-sm", selected.includes(node.id) && "bg-chrome-elev")} style={{ paddingLeft: 8 + depth * 12 }} onClick={(event) => onSelect(node.id, event.shiftKey)}>
            {node.label || node.key}
          </button>
          {node.components ? <Tree nodes={node.components} selected={selected} onSelect={onSelect} depth={depth + 1} /> : null}
          {node.columns?.map((col, index) => <Tree key={index} nodes={col.components} selected={selected} onSelect={onSelect} depth={depth + 1} />)}
        </li>
      ))}
    </ul>
  );
}

function BuilderNode({
  component,
  selected,
  onSelect,
  onDrop,
  onDelete,
  onMove,
  onDuplicate,
}: {
  component: FormComponent;
  selected: string[];
  onSelect: (id: string, shift: boolean) => void;
  onDrop: (event: DragEvent, parentId: string | null, column?: number) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
}) {
  const active = selected.includes(component.id);
  const nested = component.type === "panel" || component.type === "fieldset" || component.type === "container" || component.type === "datagrid" || component.type === "tabs";
  return (
    <div
      className={cn("rounded-lg border bg-surface p-3", active ? "border-accent" : "border-line")}
      onClick={(event) => { event.stopPropagation(); onSelect(component.id, event.shiftKey); }}
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.setData("application/x-meridian", JSON.stringify({ op: "move", id: component.id }));
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Icons.GripVertical className="size-4 text-subtle" />
        <span className="text-sm font-medium">{component.label || component.type}</span>
        <span className="font-mono text-xs text-subtle">{component.key}</span>
        {component.required ? <Badge>required</Badge> : null}
        {component.conditional ? <Badge tone="warn">conditional</Badge> : null}
        <span className="ml-auto flex gap-1">
          <button type="button" className="h-9 rounded-md px-2 text-xs text-muted" onClick={(e) => { e.stopPropagation(); onMove(component.id, -1); }}>Up</button>
          <button type="button" className="h-9 rounded-md px-2 text-xs text-muted" onClick={(e) => { e.stopPropagation(); onMove(component.id, 1); }}>Down</button>
          <button type="button" className="h-9 rounded-md px-2 text-xs text-muted" onClick={(e) => { e.stopPropagation(); onDuplicate(component.id); }}>Copy</button>
          <button type="button" className="h-9 rounded-md px-2 text-xs text-danger" onClick={(e) => { e.stopPropagation(); onDelete(component.id); }}>Delete</button>
        </span>
      </div>
      {component.description && component.type === "content" ? <p className="text-sm text-muted">{component.description}</p> : null}
      {nested ? (
        <div
          className="grid min-h-16 gap-2 rounded-md border border-dashed border-line p-2"
          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onDrop={(event) => onDrop(event, component.id)}
        >
          {(component.components ?? []).length === 0 ? <p className="text-xs text-subtle">Drop fields here</p> : null}
          {(component.components ?? []).map((child) => (
            <BuilderNode key={child.id} component={child} selected={selected} onSelect={onSelect} onDrop={onDrop} onDelete={onDelete} onMove={onMove} onDuplicate={onDuplicate} />
          ))}
        </div>
      ) : null}
      {component.type === "columns" ? (
        <div className="grid gap-2 md:grid-cols-2">
          {component.columns?.map((col, index) => (
            <div key={index} className="min-h-16 rounded-md border border-dashed border-line p-2" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => onDrop(e, component.id, index)}>
              {col.components.map((child) => (
                <BuilderNode key={child.id} component={child} selected={selected} onSelect={onSelect} onDrop={onDrop} onDelete={onDelete} onMove={onMove} onDuplicate={onDuplicate} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {!nested && component.type !== "columns" ? <p className="text-sm text-muted">{component.type}{component.placeholder ? ` · ${component.placeholder}` : ""}</p> : null}
    </div>
  );
}

function Inspector({
  form,
  component,
  count,
  onPatch,
  onForm,
  onBulk,
}: {
  form: FormDefinition;
  component: FormComponent | null;
  count: number;
  onPatch: (patch: Partial<FormComponent>) => void;
  onForm: (patch: Partial<FormDefinition>) => void;
  onBulk: (patch: Partial<FormComponent>) => void;
}) {
  if (count > 1) {
    return (
      <div className="grid gap-3 p-4 text-sm">
        <p>{count} selected</p>
        <Button className="h-10" onClick={() => onBulk({ required: true })}>Make required</Button>
        <Button variant="secondary" className="h-10" onClick={() => onBulk({ required: false })}>Make optional</Button>
        <Button variant="secondary" className="h-10" onClick={() => onBulk({ hidden: true })}>Hide</Button>
      </div>
    );
  }
  if (!component) {
    return (
      <div className="grid gap-3 p-4 text-sm">
        <p className="text-xs text-chrome-muted">Form</p>
        <label className="grid gap-1">Name
          <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={form.name} onChange={(e) => onForm({ name: e.target.value })} />
        </label>
        <label className="grid gap-1">Description
          <textarea className="min-h-24 rounded-md border border-chrome-line bg-chrome-elev px-2 py-2" value={form.description} onChange={(e) => onForm({ description: e.target.value })} />
        </label>
        <label className="grid gap-1">Submit label
          <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={form.settings.submitLabel} onChange={(e) => onForm({ settings: { ...form.settings, submitLabel: e.target.value } })} />
        </label>
        <label className="grid gap-1">Archive connection
          <select
            className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2"
            value={form.targets?.archiveConnectionId ?? "conn_local"}
            onChange={(e) => onForm({ targets: { ...form.targets, archiveConnectionId: e.target.value } })}
          >
            <option value="conn_local">Workspace archive</option>
            {(useFormStore.getState().connections ?? []).filter((item) => item.id !== "conn_local").map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.kind}{item.lastTest?.ok ? "" : " (untested)"}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">Approved PDF connection
          <select
            className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2"
            value={form.targets?.pdfConnectionId ?? form.targets?.archiveConnectionId ?? "conn_local"}
            onChange={(e) => onForm({ targets: { ...form.targets, pdfConnectionId: e.target.value } })}
          >
            <option value="conn_local">Same as archive / workspace</option>
            {(useFormStore.getState().connections ?? []).filter((item) => item.id !== "conn_local").map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">Submission JSON connection
          <select
            className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2"
            value={form.targets?.submissionConnectionId ?? "conn_local"}
            onChange={(e) => onForm({ targets: { ...form.targets, submissionConnectionId: e.target.value === "conn_local" ? undefined : e.target.value } })}
          >
            <option value="conn_local">Keep in this workspace</option>
            {(useFormStore.getState().connections ?? []).filter((item) => item.id !== "conn_local").map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">Archive path
          <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 font-mono text-xs" value={form.targets?.pathTemplate ?? form.storage?.pathTemplate ?? ""} placeholder="/suppliers/{{data.nit}}/" onChange={(e) => onForm({ targets: { ...form.targets, pathTemplate: e.target.value } })} />
        </label>
        <p className="text-xs text-chrome-muted">A remote connection is used only after Test connection succeeds. Naming S3, SharePoint, or CMIS without that test stops the archive step.</p>
        <Button variant="secondary" className="h-10" onClick={() => useFormStore.getState().setStatus(form.id, form.status === "archived" ? "draft" : "archived")}>{form.status === "archived" ? "Unarchive" : "Archive"}</Button>
        <Button variant="ghost" className="h-10 text-chrome-fg" onClick={() => {
          const id = useFormStore.getState().duplicateForm(form.id);
          if (id) toast.success("Copy created");
        }}>Duplicate form</Button>
      </div>
    );
  }
  const choice = component.type === "select" || component.type === "radio" || component.type === "selectboxes";
  return (
    <div className="grid gap-3 p-4 text-sm">
      <p className="text-xs text-chrome-muted">{component.type}</p>
      <label className="grid gap-1">Label
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={component.label} onChange={(e) => onPatch({ label: e.target.value })} />
      </label>
      <label className="grid gap-1">Key
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 font-mono" value={component.key} onChange={(e) => onPatch({ key: e.target.value })} />
      </label>
      <label className="grid gap-1">Help
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={component.description ?? ""} onChange={(e) => onPatch({ description: e.target.value })} />
      </label>
      <label className="grid gap-1">Placeholder
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={component.placeholder ?? ""} onChange={(e) => onPatch({ placeholder: e.target.value })} />
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!component.required} onChange={(e) => onPatch({ required: e.target.checked })} /> Required</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!component.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} /> Hidden</label>
      <label className="grid gap-1">Show when
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 font-mono text-xs" value={component.conditional ?? ""} placeholder='country == "CO"' onChange={(e) => onPatch({ conditional: e.target.value })} />
      </label>
      <label className="grid gap-1">Calculate
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 font-mono text-xs" value={component.calculateValue ?? ""} placeholder="quantity * unitPrice" onChange={(e) => onPatch({ calculateValue: e.target.value })} />
      </label>
      <label className="grid gap-1">Pattern
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 font-mono text-xs" value={component.validate?.pattern ?? ""} onChange={(e) => onPatch({ validate: { ...(component.validate ?? {}), pattern: e.target.value } })} />
      </label>
      <label className="grid gap-1">Classification
        <select className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={component.classification ?? "PUBLIC"} onChange={(e) => onPatch({ classification: e.target.value as FormComponent["classification"] })}>
          {["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      {choice ? (
        <label className="grid gap-1">Options
          <textarea
            className="min-h-28 rounded-md border border-chrome-line bg-chrome-elev px-2 py-2 font-mono text-xs"
            value={(component.values ?? []).map((opt) => `${opt.label}|${opt.value}`).join("\n")}
            onChange={(e) => onPatch({
              values: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
                const [label, value] = line.split("|");
                return { label: (label ?? "").trim(), value: (value ?? label ?? "").trim() };
              }),
            })}
          />
        </label>
      ) : null}
    </div>
  );
}

function DataPane({ form }: { form: FormDefinition }) {
  const all = useFormStore((s) => s.submissions);
  const submissions = useMemo(() => all.filter((item) => item.formId === form.id), [all, form.id]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = submissions.filter((item) => JSON.stringify(item.data).toLowerCase().includes(q.trim().toLowerCase()) || item.status.includes(q.trim().toLowerCase()) || item.id.includes(q.trim()));
  const current = submissions.find((item) => item.id === open);
  const labels = inputLabels(form).slice(0, 4);
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-paper p-4 text-paper-fg">
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter submissions" aria-label="Filter submissions" />
        <Button variant="secondary" onClick={() => {
          const header = ["id", "status", "createdAt", ...inputLabels(form).map((l) => l.key)];
          const lines = [header.join(",")].concat(submissions.map((item) => header.map((key) => {
            const value = key === "id" || key === "status" || key === "createdAt" ? (item as unknown as Record<string, string>)[key] : item.data[key];
            return `"${String(value ?? "").replace(/"/g, '""')}"`;
          }).join(",")));
          const blob = new Blob([lines.join("\n")], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${form.name}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}>Export CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">When</th>
              {labels.map((label) => <th key={label.key} className="px-3 py-2">{label.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="cursor-pointer border-t border-line" onClick={() => setOpen(item.id)}>
                <td className="px-3 py-3">{item.status.replaceAll("_", " ")}</td>
                <td className="px-3 py-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</td>
                {labels.map((label) => <td key={label.key} className="max-w-40 truncate px-3 py-3">{typeof item.data[label.key] === "object" ? item.id : String(item.data[label.key] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current ? (
        <pre className="mt-4 overflow-auto rounded-xl border border-line bg-chrome p-4 font-mono text-xs text-chrome-fg">{JSON.stringify({ id: current.id, status: current.status, data: current.data, workflow: current.workflow, documents: current.documents }, null, 2)}</pre>
      ) : null}
    </div>
  );
}

function ApiPane({ form }: { form: FormDefinition }) {
  const [payload, setPayload] = useState("{\n  \n}");
  const [result, setResult] = useState("");
  const submit = useFormStore((s) => s.submit);
  const schema = useMemo(() => toJsonSchema(form), [form]);
  const caps = useMemo(() => toCapabilities(form), [form]);
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-paper p-4 text-paper-fg">
      <div className="mx-auto grid max-w-4xl gap-4">
        <p className="text-sm text-muted">This is the same contract an agent gateway exposes. Running it here writes a real workspace submission. It does not call a remote URL.</p>
        <section>
          <h2 className="mb-2 font-semibold">Capabilities</h2>
          <pre className="overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{JSON.stringify(caps, null, 2)}</pre>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Input schema</h2>
          <pre className="max-h-80 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{JSON.stringify(schema, null, 2)}</pre>
        </section>
        <section className="grid gap-2">
          <h2 className="font-semibold">Validate and submit object</h2>
          <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} className="min-h-40 font-mono text-xs" aria-label="Submission object" />
          <div className="flex gap-2">
            <Button onClick={() => {
              void (async () => {
                try {
                  const data = JSON.parse(payload) as Record<string, unknown>;
                  const response = await submit({ formId: form.id, data, actor: "agent", source: "agent", idempotencyKey: `agent_${Date.now().toString(36)}` });
                  setResult(JSON.stringify(response.ok ? { submissionId: response.submission?.id, status: response.submission?.status, workflow: response.submission?.workflow } : { error: { code: response.code, message: response.message, details: response.errors } }, null, 2));
                } catch (error) {
                  setResult(error instanceof Error ? error.message : "Invalid JSON");
                }
              })();
            }}>Submit object</Button>
          </div>
          {result ? <pre className="overflow-auto rounded-xl border border-line p-3 font-mono text-xs">{result}</pre> : null}
        </section>
      </div>
    </div>
  );
}

function PdfPane({ form, onMove }: { form: FormDefinition; onMove: (id: string, pdf: NonNullable<FormComponent["pdf"]>) => void }) {
  const fields = flattenInputs(form.components).filter((c) => c.type !== "content");
  const placed = fields.filter((c) => c.pdf);
  const open = fields.filter((c) => !c.pdf);
  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-auto bg-paper p-4 text-paper-fg lg:grid-cols-[16rem_1fr]">
      <aside className="grid content-start gap-2">
        <h2 className="font-semibold">Unplaced</h2>
        {open.map((field) => (
          <button key={field.id} type="button" className="h-11 rounded-md border border-line bg-surface px-3 text-left text-sm" onClick={() => onMove(field.id, { page: 1, x: 10, y: 12 + open.indexOf(field) * 8, w: 40, h: 6 })}>
            Place {field.label}
          </button>
        ))}
        <p className="text-xs text-muted">Coordinates are stored on the component. Download a filled PDF from a submission to get the record.</p>
      </aside>
      <div className="relative mx-auto aspect-[8.5/11] w-full max-w-xl border border-line bg-elevated shadow-sm">
        <p className="absolute top-3 left-4 text-xs text-subtle">Page 1</p>
        {placed.map((field) => (
          <button
            key={field.id}
            type="button"
            className="absolute flex items-center rounded-sm border border-accent bg-paper/90 px-2 text-left text-xs"
            style={{ left: `${field.pdf!.x}%`, top: `${field.pdf!.y}%`, width: `${field.pdf!.w}%`, height: `${field.pdf!.h}%` }}
            onPointerDown={(event) => {
              const page = event.currentTarget.parentElement;
              if (!page) return;
              const rect = page.getBoundingClientRect();
              const move = (ev: PointerEvent) => {
                const x = Math.min(80, Math.max(2, ((ev.clientX - rect.left) / rect.width) * 100));
                const y = Math.min(90, Math.max(2, ((ev.clientY - rect.top) / rect.height) * 100));
                onMove(field.id, { ...field.pdf!, x, y });
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            {field.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FlowPane({ form, onChange }: { form: FormDefinition; onChange: (workflow: FormDefinition["workflow"]) => void }) {
  const flow = form.workflow;
  const [title, setTitle] = useState("Compliance review");
  const [role, setRole] = useState("Compliance");
  if (!flow) {
    return (
      <div className="bg-paper p-6 text-paper-fg">
        <p className="mb-3 text-sm text-muted">No business workflow yet. Form navigation and approval are separate.</p>
        <Button onClick={() => onChange({
          nodes: [
            { id: "start", type: "start", title: "Submitted" },
            { id: "review", type: "human", title: "Review", role: "Reviewer" },
            { id: "done", type: "end", title: "Approved" },
            { id: "rejected", type: "end", title: "Rejected" },
          ],
          edges: [
            { from: "start", to: "review", when: "approved" },
            { from: "review", to: "done", when: "approved" },
            { from: "review", to: "rejected", when: "rejected" },
          ],
        })}>Add a review step</Button>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-paper p-4 text-paper-fg">
      <ol className="mx-auto grid max-w-xl gap-2">
        {flow.nodes.map((node) => (
          <li key={node.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <p className="text-xs text-muted">{node.type}{node.role ? ` · ${node.role}` : ""}{node.service ? ` · ${node.service}` : ""}</p>
            <p className="font-medium">{node.title}</p>
          </li>
        ))}
      </ol>
      <div className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Step title" />
        <Input value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" />
        <Button onClick={() => {
          const id = uniqueKey(title || "step", new Set(flow.nodes.map((n) => n.id)));
          const humans = flow.nodes.filter((n) => n.type === "human" || n.type === "approval");
          const lastHuman = humans[humans.length - 1];
          const node = { id, type: "human" as const, title: title || "Review", role };
          const edges = flow.edges.map((edge) => (lastHuman && edge.from === lastHuman.id && edge.when === "approved" ? { ...edge, from: id } : edge));
          if (lastHuman) edges.push({ from: lastHuman.id, to: id, when: "approved" });
          edges.push({ from: id, to: "rejected", when: "rejected" });
          onChange({ nodes: [...flow.nodes.filter((n) => n.type !== "end"), node, ...flow.nodes.filter((n) => n.type === "end")], edges });
        }}>Add step</Button>
        <Button variant="secondary" onClick={() => {
          const id = uniqueKey("store", new Set(flow.nodes.map((n) => n.id)));
          onChange({
            nodes: [...flow.nodes.filter((n) => n.type !== "end"), { id, type: "service", title: "Store document", service: "archive" }, ...flow.nodes.filter((n) => n.type === "end")],
            edges: [...flow.edges, { from: flow.nodes.filter((n) => n.type !== "end").at(-1)?.id || "start", to: id, when: "approved" }],
          });
        }}>Add storage step</Button>
      </div>
    </div>
  );
}
