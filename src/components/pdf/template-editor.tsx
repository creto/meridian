import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, FieldLabel, Input } from "@/components/ui/primitives";
import {
  PDF_FIELD_TYPES,
  addPlacement,
  alignPlacements,
  boxToPixels,
  createEditor,
  deletePlacements,
  distribute,
  duplicatePlacements,
  hitTest,
  nudge,
  placementsOnPage,
  redo,
  setSelection,
  setView,
  undo,
  updatePlacement,
  type AlignEdge,
  type EditorState,
  type PdfFieldType,
} from "@/lib/pdf/editor-model";

const PAGE_W = 640;
const PAGE_H = 820;

export function TemplateEditor({ templateId }: { templateId: string }) {
  const [state, setState] = useState<EditorState>(() => createEditor({ templateId, pageCount: 3, snap: true, grid: 0.01 }));
  const [page, setPage] = useState(0);
  const [sample, setSample] = useState('{"legalName":"Northwind Traders","phone":"+52 55 0000 0000"}');
  const [live, setLive] = useState("Ready");
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      const ids = state.selected;
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        setState((current) => (event.shiftKey ? redo(current) : undo(current)));
      } else if ((event.ctrlKey || event.metaKey) && event.key === "d") {
        event.preventDefault();
        setState((current) => duplicatePlacements(current, ids));
      } else if (event.key === "Delete" || event.key === "Backspace") {
        setState((current) => deletePlacements(current, ids));
      } else if (event.key === "ArrowLeft") setState((current) => nudge(current, ids, "left", event.shiftKey));
      else if (event.key === "ArrowRight") setState((current) => nudge(current, ids, "right", event.shiftKey));
      else if (event.key === "ArrowUp") setState((current) => nudge(current, ids, "up", event.shiftKey));
      else if (event.key === "ArrowDown") setState((current) => nudge(current, ids, "down", event.shiftKey));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.selected]);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(sample) as Record<string, string>;
    } catch {
      return {};
    }
  }, [sample]);

  const items = placementsOnPage(state.present, page);
  const selected = state.present.placements.find((item) => item.id === state.selected[0]);

  function point(event: React.PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (event.clientX - rect.left) / PAGE_W, y: (event.clientY - rect.top) / PAGE_H };
  }

  function announce(message: string) {
    setLive(message);
  }

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] bg-paper text-paper-fg">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <Link to="/admin" className="text-sm text-muted">Admin</Link>
        <h1 className="text-base font-semibold">PDF template {templateId}</h1>
        <span className="text-sm text-muted">Version {state.present.version}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button aria-label="Undo" onClick={() => setState((current) => undo(current))}>Undo</Button>
          <Button aria-label="Redo" onClick={() => setState((current) => redo(current))}>Redo</Button>
          <Button aria-label="Fit width" onClick={() => setState((current) => setView(current, { fit: "width", zoom: 1 }))}>Fit width</Button>
          <Button aria-label="Fit page" onClick={() => setState((current) => setView(current, { fit: "page", zoom: 0.8 }))}>Fit page</Button>
          <Button aria-label="Rotate view" onClick={() => setState((current) => setView(current, { viewRotation: ((current.present.viewRotation + 90) % 360) as 0 | 90 | 180 | 270 }))}>Rotate</Button>
          <Button aria-label="Toggle snap" onClick={() => setState((current) => setView(current, { snap: !current.present.snap }))}>{state.present.snap ? "Snap on" : "Snap off"}</Button>
          <Button onClick={() => {
            void fetch("/api/admin/overlays", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ templateId, templateVersion: state.present.version, placements: state.present.placements }),
            }).then(async (response) => {
              const payload = await response.json() as { saved?: number; error?: { message: string } };
              announce(response.ok ? `Saved ${payload.saved ?? 0} fields` : (payload.error?.message ?? "Save failed"));
            }).catch(() => announce("Save failed"));
          }}>Save</Button>
          <Button onClick={() => announce("Preview uses the sample object")}>Preview</Button>
          <Button onClick={() => setState((current) => ({ ...current, present: { ...current.present, version: current.present.version + 1 } }))}>Publish</Button>
        </div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_280px]">
        <aside className="border-r border-line p-3" aria-label="Pages">
          {Array.from({ length: state.present.pageCount }, (_, index) => (
            <button key={index} type="button" className={`mb-2 block w-full rounded-md border px-2 py-6 text-left text-sm ${index === page ? "border-accent bg-surface" : "border-line"}`} onClick={() => setPage(index)}>
              Page {index + 1}
              <span className="block text-xs text-muted">{placementsOnPage(state.present, index).length} fields</span>
            </button>
          ))}
          <Button onClick={() => setState((current) => addPlacement(current, { page, componentKey: `field_${current.present.placements.length + 1}`, pdfFieldType: "text" }))}>Add field</Button>
        </aside>
        <div className="overflow-auto p-6">
          <div
            role="region"
            aria-label="PDF canvas"
            className="relative border border-line bg-white shadow-sm"
            style={{ width: PAGE_W, height: PAGE_H, transform: `rotate(${state.present.viewRotation}deg) scale(${state.present.zoom})`, transformOrigin: "top left" }}
            onPointerDown={(event) => {
              const at = point(event);
              const hit = hitTest(state.present, page, at.x, at.y);
              if (!hit) {
                setState((current) => setSelection(current, []));
                return;
              }
              setState((current) => setSelection(current, [hit.id], event.shiftKey ? "toggle" : "replace"));
              drag.current = { id: hit.id, x: at.x, y: at.y };
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const at = point(event);
              const dx = at.x - drag.current.x;
              const dy = at.y - drag.current.y;
              drag.current = { id: drag.current.id, x: at.x, y: at.y };
              const ids = state.selected.includes(drag.current.id) ? state.selected : [drag.current.id];
              setState((current) => {
                const moved = current.present.placements.find((item) => item.id === drag.current?.id);
                if (!moved) return current;
                return {
                  ...current,
                  present: {
                    ...current.present,
                    placements: current.present.placements.map((item) => ids.includes(item.id) ? { ...item, x: Math.min(1 - item.w, Math.max(0, item.x + dx)), y: Math.min(1 - item.h, Math.max(0, item.y + dy)) } : item),
                  },
                };
              });
            }}
            onPointerUp={() => { drag.current = null; }}
          >
            {items.map((item) => {
              const box = boxToPixels(item, PAGE_W, PAGE_H);
              const value = parsed[item.componentKey];
              return (
                <div key={item.id} className={`absolute border text-xs ${state.selected.includes(item.id) ? "border-accent bg-amber-50" : "border-line-strong bg-white/80"}`} style={{ left: box.left, top: box.top, width: box.width, height: box.height, transform: `rotate(${item.rotation}deg)` }}>
                  <span className="block truncate px-1">{value || item.componentKey}</span>
                </div>
              );
            })}
          </div>
          <p className="sr-only" aria-live="polite">{live}. {state.selected.length} selected.</p>
        </div>
        <aside className="border-l border-line p-4">
          <h2 className="mb-3 text-sm font-semibold">Inspector</h2>
          {selected ? (
            <div className="grid gap-3">
              <FieldLabel>Component key</FieldLabel>
              <Input aria-label="Component key" value={selected.componentKey} onChange={(event) => setState((current) => updatePlacement(current, selected.id, { componentKey: event.target.value }))} />
              <FieldLabel>Field type</FieldLabel>
              <select aria-label="PDF field type" className="h-10 rounded-md border border-line bg-surface px-2" value={selected.pdfFieldType} onChange={(event) => setState((current) => updatePlacement(current, selected.id, { pdfFieldType: event.target.value as PdfFieldType }))}>
                {PDF_FIELD_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
              <FieldLabel>Font size</FieldLabel>
              <Input aria-label="Font size" type="number" value={selected.fontSize} onChange={(event) => setState((current) => updatePlacement(current, selected.id, { fontSize: Number(event.target.value) }))} />
              <FieldLabel>Alignment</FieldLabel>
              <select aria-label="Alignment" className="h-10 rounded-md border border-line bg-surface px-2" value={selected.align} onChange={(event) => setState((current) => updatePlacement(current, selected.id, { align: event.target.value as "left" | "center" | "right" }))}>
                <option value="left">left</option>
                <option value="center">center</option>
                <option value="right">right</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.required} onChange={(event) => setState((current) => updatePlacement(current, selected.id, { required: event.target.checked }))} /> Required</label>
              <div className="flex flex-wrap gap-2">
                {(["left", "right", "top", "bottom"] as AlignEdge[]).map((edge) => (
                  <Button key={edge} aria-label={`Align ${edge}`} onClick={() => setState((current) => alignPlacements(current, current.selected, edge))}>{edge}</Button>
                ))}
                <Button aria-label="Distribute horizontally" onClick={() => setState((current) => distribute(current, current.selected, "horizontal"))}>Distribute H</Button>
                <Button aria-label="Distribute vertically" onClick={() => setState((current) => distribute(current, current.selected, "vertical"))}>Distribute V</Button>
              </div>
            </div>
          ) : <p className="text-sm text-muted">Select a field. Arrow keys nudge. Shift nudges finely.</p>}
          <FieldLabel hint="Preview values">Sample data</FieldLabel>
          <textarea aria-label="Sample submission JSON" className="mt-2 h-32 w-full rounded-md border border-line p-2 font-mono text-xs" value={sample} onChange={(event) => setSample(event.target.value)} />
        </aside>
      </div>
    </div>
  );
}
