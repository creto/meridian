import { Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { FormRuntime } from "@/components/forms/runtime";
import { Mark } from "@/components/shell";
import { Badge, Button, Input, Modal, Textarea } from "@/components/ui/primitives";
import { proposeEdit } from "@/lib/forms/assistant";
import { editFormWithModel, type ChatTurn } from "@/lib/forms/ai.functions";
import { proposalFromModel, type EditProposal } from "@/lib/forms/llm";
import { CATALOG, createComponent, GROUPS } from "@/lib/forms/catalog";
import { PropertyInspector } from "@/components/studio/property-inspector";
import { PdfPane } from "@/components/studio/pdf-pane";
import { DataPane } from "@/components/studio/data-pane";
import { JsonPane } from "@/components/studio/json-pane";
import { LogicPane } from "@/components/studio/logic-pane";
import { ApiPane } from "@/components/studio/api-pane";
import { FlowPane } from "@/components/studio/flow-pane";
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
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

  function addType(type: ComponentType, parentId?: string | null, formioType?: string) {
    if (!form) return;
    const taken = new Set(collectKeys(form.components));
    const item = CATALOG.find((entry) => entry.type === type && entry.formioType === formioType) ?? CATALOG.find((entry) => entry.type === type);
    const key = uniqueKey(item?.label ?? type, taken);
    const component = createComponent(type, key, undefined, formioType ?? item?.formioType);
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
  const filtered = CATALOG.filter((item) => `${item.label} ${item.type} ${item.formioType ?? ""} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()));

  const onDrop = (event: DragEvent, parentId: string | null, column?: number) => {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer.getData("application/x-meridian");
    if (!raw) return;
    const payload = JSON.parse(raw) as { op: "new"; type: ComponentType; formioType?: string } | { op: "move"; id: string };
    if (payload.op === "new") {
      const taken = new Set(collectKeys(form.components));
      const key = uniqueKey(payload.formioType ?? payload.type, taken);
      const component = createComponent(payload.type, key, undefined, payload.formioType);
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
        <Button variant="ghost" className={cn("h-10 text-chrome-fg hover:bg-white/10", assistOpen && "bg-chrome-elev")} onClick={() => setAssistOpen((open) => !open)}>{assistOpen ? "Close Grok" : "Ask Grok"}</Button>
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
                          key={`${item.type}:${item.formioType ?? ""}`}
                          type="button"
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("application/x-meridian", JSON.stringify({ op: "new", type: item.type, formioType: item.formioType }))}
                          onClick={() => addType(item.type, null, item.formioType)}
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
                    Add a field from the palette, or ask Grok to change this form.
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
        <JsonPane
          form={form}
          onApply={(parsed) => updateForm(form.id, (current) => ({
            ...current,
            title: typeof parsed.title === "string" ? parsed.title : current.title,
            display: parsed.display === "wizard" ? "wizard" : parsed.display === "form" ? "form" : current.display,
            components: parsed.components ?? current.components,
            workflow: parsed.workflow ?? current.workflow,
            settings: parsed.settings ? { ...current.settings, ...parsed.settings } : current.settings,
          }), "Updated from JSON")}
        />
      ) : null}

      {mode === "Logic" ? <LogicPane form={form} onComponents={(components) => commit(components)} /> : null}

      {mode === "API" ? <ApiPane form={form} /> : null}
      {mode === "PDF" ? (
        <PdfPane
          form={form}
          onComponents={(components, history) => {
            if (history) commit(components);
            else updateForm(form.id, (current) => ({ ...current, components }));
          }}
          onForm={(patch) => patchMeta(patch)}
        />
      ) : null}
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

      <Designer
        key={form.id}
        form={form}
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        onApply={(proposal) => {
          setPast((stack) => [...stack, form.components].slice(-40));
          setFuture([]);
          updateForm(form.id, (current) => ({
            ...current,
            title: proposal.title,
            description: proposal.description,
            display: proposal.display,
            components: proposal.components,
            workflow: proposal.workflow ?? current.workflow,
          }), proposal.summary[0] ?? "Updated from the assistant");
          toast.success("Applied to the canvas");
        }}
      />
      <button type="button" className="sr-only" onClick={() => setVersionsOpen(true)}>Versions</button>
    </div>
  );
}

interface DesignerTurn {
  role: "user" | "assistant";
  content: string;
  provider?: "grok" | "local";
  proposal?: EditProposal;
  status?: "pending" | "applied" | "discarded" | "revised";
}

function suggestionsFor(form: FormDefinition): string[] {
  const first = flattenInputs(form.components)[0]?.label;
  return [
    form.components.length === 0 ? "Design this form from a short description of who fills it in" : "Add a notes field at the end",
    form.display === "wizard" ? "Make this a single page" : "Turn this into a wizard and add a review page",
    first ? `What is required, and when does ${first} appear?` : "Which fields should be required?",
  ];
}

function Designer({
  form,
  open,
  onClose,
  onApply,
}: {
  form: FormDefinition;
  open: boolean;
  onClose: () => void;
  onApply: (proposal: EditProposal) => void;
}) {
  const [turns, setTurns] = useState<DesignerTurn[]>([]);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = [...turns].reverse().find((turn) => turn.status === "pending" && turn.proposal?.valid);

  const ask = async (text: string) => {
    const content = text.trim();
    if (content.length < 3 || busy) return;
    const pendingTurn = [...turns].reverse().find((turn) => turn.status === "pending" && turn.proposal);
    const base = pendingTurn?.proposal
      ? {
          ...form,
          title: pendingTurn.proposal.title,
          description: pendingTurn.proposal.description,
          display: pendingTurn.proposal.display,
          components: pendingTurn.proposal.components,
          workflow: pendingTurn.proposal.workflow ?? form.workflow,
        }
      : form;
    const history: ChatTurn[] = turns.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.status ? `${turn.content} (${turn.status})` : turn.content,
    }));
    setTurns((curr) => [...curr, { role: "user", content }]);
    setInstruction("");
    setBusy(true);
    try {
      const result = await editFormWithModel({
        data: {
          instruction: content,
          history,
          form: { id: base.id, title: base.title, description: base.description, display: base.display, components: base.components, workflow: base.workflow },
        },
      });
      if (!result.ok) {
        const local = proposeEdit(base, content);
        if (!local.valid) {
          setTurns((curr) => [...curr, { role: "assistant", content: result.error, provider: "local" }]);
          return;
        }
        const next = local.apply(base);
        const proposal: EditProposal = {
          valid: true,
          reply: `${result.error} The on-device designer suggested this instead.`,
          summary: local.summary,
          issues: local.issues,
          title: next.title,
          description: next.description,
          display: next.display,
          components: next.components,
          workflow: next.workflow,
        };
        setTurns((curr) => curr.map((turn) => (turn.status === "pending" ? { ...turn, status: "revised" as const } : turn)).concat({
          role: "assistant" as const,
          content: proposal.reply,
          provider: "local" as const,
          proposal,
          status: "pending" as const,
        }));
        return;
      }
      const proposal = proposalFromModel(base, result);
      setTurns((curr) => {
        const retired = proposal.valid ? curr.map((turn) => (turn.status === "pending" ? { ...turn, status: "revised" as const } : turn)) : curr;
        return [...retired, {
          role: "assistant",
          content: proposal.reply || result.reply || "I need a more specific change.",
          provider: result.provider,
          proposal: proposal.valid ? proposal : undefined,
          status: proposal.valid ? "pending" : undefined,
        }];
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The assistant didn't answer";
      setTurns((curr) => [...curr, { role: "assistant", content: message }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <aside className="fixed inset-0 z-30 flex flex-col bg-paper text-paper-fg sm:inset-y-0 sm:left-auto sm:w-[26rem] sm:border-l sm:border-line sm:shadow-lg">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div>
          <h2 className="text-sm font-semibold">Ask Grok</h2>
          <p className="text-xs text-muted">Nothing changes on the canvas until you apply it.</p>
        </div>
        <Button variant="ghost" className="h-10" onClick={onClose}>Close</Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4" role="log" aria-live="polite">
        {turns.length === 0 ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted">Describe a change in ordinary language. You can follow up — “make that optional”, “also add a phone” — and Grok keeps the draft in mind.</p>
            {suggestionsFor(form).map((item) => (
              <button key={item} type="button" className="rounded-lg border border-line px-3 py-3 text-left text-sm hover:bg-surface" onClick={() => setInstruction(item)}>
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {turns.map((turn, index) => (
          <article key={index} className={turn.role === "user" ? "ml-8 rounded-lg bg-chrome px-3 py-3 text-sm text-chrome-fg" : "mr-6 grid gap-2"}>
            {turn.role === "assistant" ? <p className="text-xs text-subtle">{turn.provider === "local" ? "On-device" : "Grok"}</p> : null}
            <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
            {turn.proposal && turn.status === "pending" ? <ProposalCard form={form} proposal={turn.proposal} onApply={() => {
              onApply(turn.proposal!);
              setTurns((curr) => curr.map((item, itemIndex) => (itemIndex === index ? { ...item, status: "applied" } : item)));
            }} onDiscard={() => setTurns((curr) => curr.map((item, itemIndex) => (itemIndex === index ? { ...item, status: "discarded" } : item)))} /> : null}
            {turn.status === "applied" ? <p className="text-xs text-ok">Applied to the canvas. You can keep going.</p> : null}
            {turn.status === "revised" ? <p className="text-xs text-subtle">Folded into the next draft.</p> : null}
            {turn.status === "discarded" && turn.proposal ? <p className="text-xs text-subtle">Not applied.</p> : null}
          </article>
        ))}
        {busy ? <p className="text-sm text-muted">Grok is reading {form.title}…</p> : null}
      </div>
      <form
        className="grid gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(instruction);
        }}
      >
        {pending ? <p className="text-xs text-muted">A change is waiting. Apply it, or send another instruction to revise the draft.</p> : null}
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Add a website, and show it only for foreign suppliers"
          aria-label="Instruction"
          className="min-h-20"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask(instruction);
            }
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || instruction.trim().length < 3}>{busy ? "Reading…" : "Send"}</Button>
        </div>
      </form>
    </aside>
  );
}

function ProposalCard({
  form,
  proposal,
  onApply,
  onDiscard,
}: {
  form: FormDefinition;
  proposal: EditProposal;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const diff = semanticDiff(form.components, proposal.components);
  const workflowChanged = JSON.stringify(proposal.workflow ?? null) !== JSON.stringify(form.workflow ?? null);
  return (
    <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
      {diff.added.map((line) => <p key={line} className="text-sm">Add {line}</p>)}
      {diff.removed.map((line) => <p key={line} className="text-sm">Remove {line}</p>)}
      {diff.changed.map((line) => <p key={line} className="text-sm">{line}</p>)}
      {proposal.title !== form.title ? <p className="text-sm">Title becomes “{proposal.title}”</p> : null}
      {proposal.display !== form.display ? <p className="text-sm">{proposal.display === "wizard" ? "Becomes a wizard" : "Becomes a single page"}</p> : null}
      {workflowChanged ? <p className="text-sm">Workflow updated</p> : null}
      {proposal.issues.map((line) => <p key={line} className="text-sm text-warn">{line}</p>)}
      {diff.added.length + diff.removed.length + diff.changed.length === 0 && proposal.title === form.title && !workflowChanged ? <p className="text-sm text-muted">No field changes to show.</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button className="h-10" onClick={onApply}>Apply to canvas</Button>
        <Button variant="secondary" className="h-10" onClick={onDiscard}>Discard</Button>
      </div>
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
        <Button variant="secondary" className="h-10" onClick={() => onBulk({ disabled: true })}>Disable</Button>
        <p className="text-xs text-chrome-muted">Shared settings apply only where every selected field already exists. Open one field for the full Form.io settings list.</p>
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
  return (
    <PropertyInspector
      component={component}
      siblings={form.components}
      onChange={(next) => onPatch(next)}
    />
  );
}
