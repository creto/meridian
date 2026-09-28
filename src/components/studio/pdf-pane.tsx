import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui/primitives";
import { clearPdfBackground, loadPdfBackground, savePdfBackground } from "@/lib/forms/pdf-background";
import { downloadBytes } from "@/lib/forms/pdf";
import {
  defaultPlacement,
  exportOverlays,
  formatPdfValue,
  importOverlayList,
  renderFormPdf,
  sampleSubmission,
  withPdfPlacement,
} from "@/lib/forms/pdf-layout";
import { flattenInputs, updateComponent } from "@/lib/forms/tree";
import type { FormComponent, FormDefinition, PdfPlacement } from "@/lib/forms/types";

function pdfBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function PdfPane({
  form,
  onComponents,
  onForm,
}: {
  form: FormDefinition;
  onComponents: (components: FormComponent[], history: boolean) => void;
  onForm: (patch: Partial<FormDefinition>) => void;
}) {
  const fields = flattenInputs(form.components).filter((component) => component.type !== "content" && component.type !== "button" && component.type !== "review");
  const placed = fields.filter((component) => component.pdf);
  const open = fields.filter((component) => !component.pdf);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [view, setView] = useState<"design" | "preview">("design");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState(() => JSON.stringify(sampleSubmission(form.components), null, 2));
  const [status, setStatus] = useState("Place fields, then download the PDF.");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [background, setBackground] = useState<Uint8Array | null>(null);
  const [pageRatio, setPageRatio] = useState(8.5 / 11);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; x: number; y: number; pdf: PdfPlacement; latest: PdfPlacement } | null>(null);
  const [draft, setDraft] = useState<{ id: string; pdf: PdfPlacement } | null>(null);

  const pageCount = Math.max(1, form.pdfPages || form.settings.pdf?.pageCount || 1);
  const safePage = Math.min(page, pageCount);
  const selected = fields.find((component) => component.id === selectedId) ?? null;
  const sample = useMemo(() => {
    try {
      const parsed = JSON.parse(sampleText) as Record<string, unknown>;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return null;
    }
  }, [sampleText]);

  useEffect(() => {
    let url = "";
    void loadPdfBackground(form.id).then(async (stored) => {
      if (!stored) return;
      setBackground(stored.bytes);
      url = URL.createObjectURL(pdfBlob(stored.bytes));
      setBackgroundUrl(url);
      const doc = await PDFDocument.load(stored.bytes).catch(() => null);
      const first = doc?.getPage(0);
      if (first) {
        const size = first.getSize();
        setPageRatio(size.width / size.height);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [form.id]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (!selected?.pdf) return;
      const step = event.shiftKey ? 0.4 : snap ? 1 : 0.5;
      if (event.key === "ArrowLeft") shift(selected, -step, 0);
      else if (event.key === "ArrowRight") shift(selected, step, 0);
      else if (event.key === "ArrowUp") shift(selected, 0, -step);
      else if (event.key === "ArrowDown") shift(selected, 0, step);
      else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        commitPlacement(selected, undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function commitPlacement(component: FormComponent, pdf: PdfPlacement | undefined) {
    onComponents(updateComponent(form.components, component.id, withPdfPlacement(component, pdf)), true);
    if (!pdf) setSelectedId(null);
  }

  function shift(component: FormComponent, dx: number, dy: number) {
    if (!component.pdf) return;
    const pdf = component.pdf;
    commitPlacement(component, {
      ...pdf,
      x: clamp(pdf.x + dx, 0, 100 - pdf.w),
      y: clamp(pdf.y + dy, 0, 100 - pdf.h),
    });
  }

  function grid(value: number) {
    if (!snap) return value;
    return Math.round(value);
  }

  async function produce(mode: "blank" | "filled") {
    if (mode === "filled" && !sample) throw new Error("Sample data is not valid JSON");
    const bytes = await renderFormPdf({
      title: form.title,
      pageCount,
      components: form.components,
      data: sample ?? {},
      background,
      mode,
      appendRecord: mode === "filled",
    });
    return bytes;
  }

  async function download(mode: "blank" | "filled") {
    setBusy(true);
    try {
      const bytes = await produce(mode);
      downloadBytes(bytes, `${form.name}-${mode}.pdf`);
      setStatus(mode === "filled" ? "Filled PDF downloaded." : "Blank PDF downloaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not build the PDF";
      setStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function openPreview() {
    setBusy(true);
    try {
      const bytes = await produce("filled");
      const url = URL.createObjectURL(pdfBlob(bytes));
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setView("preview");
      setStatus("Preview is the file that downloads.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not preview the PDF";
      setStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = doc.getPageCount();
      const size = doc.getPage(0).getSize();
      await savePdfBackground(form.id, file.name, bytes);
      setBackground(bytes);
      setBackgroundUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(pdfBlob(bytes));
      });
      setPageRatio(size.width / size.height);
      onForm({ pdfPages: Math.max(pageCount, count), settings: { ...form.settings, pdf: { fileName: file.name, pageCount: count } } });
      setStatus(`Loaded ${file.name}, ${count} page${count === 1 ? "" : "s"}.`);
    } catch {
      setStatus("That file is not a readable PDF.");
      toast.error("That file is not a readable PDF");
    }
  }

  function autoPlace() {
    let next = form.components;
    open.forEach((component, index) => {
      next = updateComponent(next, component.id, withPdfPlacement(component, defaultPlacement(index, safePage)));
    });
    const pagesNeeded = Math.max(pageCount, Math.ceil(open.length / 10));
    onComponents(next, true);
    if (pagesNeeded !== pageCount) onForm({ pdfPages: pagesNeeded });
    setStatus(`Placed ${open.length} field${open.length === 1 ? "" : "s"}.`);
  }

  function applyOverlays(raw: unknown) {
    const incoming = importOverlayList(raw);
    let next = form.components;
    let hit = 0;
    for (const item of incoming) {
      const component = fields.find((field) => field.key === item.key);
      if (!component) continue;
      next = updateComponent(next, component.id, withPdfPlacement(component, { ...component.pdf, ...item.pdf }));
      hit += 1;
    }
    onComponents(next, true);
    const maxPage = incoming.reduce((max, item) => Math.max(max, item.pdf.page), pageCount);
    if (maxPage > pageCount) onForm({ pdfPages: maxPage });
    setStatus(hit ? `Imported ${hit} overlay${hit === 1 ? "" : "s"}.` : "No matching field keys in that file.");
  }

  const onPage = placed.filter((component) => (draft?.id === component.id ? draft.pdf.page : component.pdf?.page) === safePage);

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] bg-paper text-paper-fg">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Button onClick={() => void download("filled")} disabled={busy}>Download filled PDF</Button>
        <Button variant="secondary" onClick={() => void download("blank")} disabled={busy}>Download blank</Button>
        <Button variant="secondary" onClick={() => void openPreview()} disabled={busy}>Preview</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>Upload PDF</Button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Upload PDF template" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onUpload(file);
        }} />
        {background ? <Button variant="ghost" onClick={() => {
          void clearPdfBackground(form.id);
          setBackground(null);
          setBackgroundUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return "";
          });
          onForm({ settings: { ...form.settings, pdf: undefined } });
          setStatus("Background removed. Placements stay.");
        }}>Remove background</Button> : null}
        <Button variant="secondary" onClick={() => onForm({ pdfPages: pageCount + 1 })}>Add page</Button>
        <Button variant="secondary" disabled={pageCount < 2} onClick={() => {
          let next = form.components;
          for (const component of placed) {
            if (component.pdf && component.pdf.page === pageCount) next = updateComponent(next, component.id, withPdfPlacement(component, undefined));
            else if (component.pdf && component.pdf.page > pageCount) next = updateComponent(next, component.id, withPdfPlacement(component, { ...component.pdf, page: pageCount }));
          }
          onComponents(next, true);
          onForm({ pdfPages: pageCount - 1 });
          setPage(Math.min(safePage, pageCount - 1));
        }}>Remove page</Button>
        <Button variant="secondary" onClick={() => setSnap((value) => !value)}>{snap ? "Snap on" : "Snap off"}</Button>
        <label className="flex items-center gap-2 text-xs text-muted">Zoom
          <input aria-label="Zoom" type="range" min={0.6} max={1.6} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        <Button variant="ghost" onClick={() => {
          downloadBytes(new TextEncoder().encode(JSON.stringify({ components: exportOverlays(form.components) }, null, 2)), `${form.name}-overlays.json`, "application/json");
          setStatus("Exported Form.io overlays.");
        }}>Export overlays</Button>
        <Button variant="ghost" onClick={() => overlayRef.current?.click()}>Import overlays</Button>
        <input ref={overlayRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import overlay JSON" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void file.text().then((text) => {
            try {
              applyOverlays(JSON.parse(text));
            } catch {
              setStatus("That overlay file is not JSON.");
            }
          });
        }} />
        <span className="text-xs text-muted">{status}</span>
      </div>
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[16rem_1fr_17rem]">
        <aside className="grid content-start gap-2 overflow-auto border-r border-line p-3">
          <h2 className="text-sm font-semibold">Pages</h2>
          {Array.from({ length: pageCount }, (_, index) => (
            <button key={index} type="button" className={`rounded-md border px-3 py-2 text-left text-sm ${safePage === index + 1 ? "border-accent bg-surface" : "border-line"}`} onClick={() => { setPage(index + 1); setView("design"); }}>
              Page {index + 1}
              <span className="block text-xs text-muted">{placed.filter((component) => component.pdf?.page === index + 1).length} fields</span>
            </button>
          ))}
          <h2 className="mt-2 text-sm font-semibold">Unplaced</h2>
          {open.length === 0 ? <p className="text-xs text-muted">Every input is on a page.</p> : <Button variant="secondary" onClick={autoPlace}>Place all</Button>}
          {open.map((component) => (
            <button
              key={component.id}
              type="button"
              draggable
              className="rounded-md border border-line bg-surface px-3 py-2 text-left text-sm"
              onDragStart={(event) => event.dataTransfer.setData("application/x-meridian-pdf", component.id)}
              onClick={() => commitPlacement(component, defaultPlacement(open.indexOf(component), safePage))}
            >
              {component.label}
              <span className="block text-xs text-muted">{component.type}</span>
            </button>
          ))}
        </aside>
        <div className="min-h-0 overflow-auto p-4">
          {view === "preview" && previewUrl ? (
            <iframe title="Filled PDF preview" src={previewUrl} className="mx-auto h-[820px] w-full max-w-3xl border border-line bg-white" />
          ) : (
            <div className="mx-auto" style={{ width: `${640 * zoom}px` }}>
              <div
                ref={pageRef}
                className="relative w-full border border-line bg-white shadow-sm"
                style={{ aspectRatio: String(pageRatio) }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("application/x-meridian-pdf");
                  const rect = pageRef.current?.getBoundingClientRect();
                  const component = fields.find((item) => item.id === id);
                  if (!id || !rect || !component) return;
                  const width = component.pdf?.w ?? 40;
                  const height = component.pdf?.h ?? 5.5;
                  const x = grid(clamp(((event.clientX - rect.left) / rect.width) * 100 - width / 2, 0, 100 - width));
                  const y = grid(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100 - height));
                  commitPlacement(component, { ...(component.pdf ?? defaultPlacement(0, safePage)), page: safePage, x, y, w: width, h: height });
                  setSelectedId(id);
                }}
              >
                {backgroundUrl ? <iframe title="PDF background" src={`${backgroundUrl}#page=${safePage}&toolbar=0&navpanes=0`} className="pointer-events-none absolute inset-0 h-full w-full" /> : <p className="absolute top-3 left-4 text-xs text-subtle">Page {safePage}</p>}
                {onPage.map((component) => {
                  const pdf = draft?.id === component.id ? draft.pdf : component.pdf!;
                  const value = sample ? formatPdfValue(component, sample[component.key]) : "";
                  return (
                    <div
                      key={component.id}
                      className={`absolute overflow-hidden border bg-white/85 text-left text-[11px] leading-tight ${selectedId === component.id ? "border-accent" : "border-neutral-700"}`}
                      style={{ left: `${pdf.x}%`, top: `${pdf.y}%`, width: `${pdf.w}%`, height: `${pdf.h}%`, textAlign: pdf.align ?? "left", fontSize: Math.max(9, (pdf.fontSize ?? 11) * zoom * 0.75) }}
                      onPointerDown={(event) => {
                        const rect = pageRef.current?.getBoundingClientRect();
                        const handle = (event.target as HTMLElement).dataset.resize === "true";
                        if (!rect) return;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        drag.current = { id: component.id, mode: handle ? "resize" : "move", x: event.clientX, y: event.clientY, pdf, latest: pdf };
                        setSelectedId(component.id);
                        setDraft({ id: component.id, pdf });
                        const move = (ev: PointerEvent) => {
                          const active = drag.current;
                          const box = pageRef.current?.getBoundingClientRect();
                          if (!active || active.id !== component.id || !box) return;
                          const latest = active.mode === "move"
                            ? {
                                ...active.pdf,
                                x: grid(clamp(active.pdf.x + ((ev.clientX - active.x) / box.width) * 100, 0, 100 - active.pdf.w)),
                                y: grid(clamp(active.pdf.y + ((ev.clientY - active.y) / box.height) * 100, 0, 100 - active.pdf.h)),
                              }
                            : {
                                ...active.pdf,
                                w: grid(clamp(active.pdf.w + ((ev.clientX - active.x) / box.width) * 100, 4, 100 - active.pdf.x)),
                                h: grid(clamp(active.pdf.h + ((ev.clientY - active.y) / box.height) * 100, 2, 100 - active.pdf.y)),
                              };
                          active.latest = latest;
                          setDraft({ id: component.id, pdf: latest });
                        };
                        const up = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", up);
                          const latest = drag.current?.id === component.id ? drag.current.latest : null;
                          const start = drag.current?.pdf;
                          drag.current = null;
                          setDraft(null);
                          if (latest && start && (latest.x !== start.x || latest.y !== start.y || latest.w !== start.w || latest.h !== start.h)) {
                            commitPlacement(component, latest);
                          }
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }}
                    >
                      <span className="block truncate px-1 font-medium">{pdf.showLabel === false ? value || component.label : component.label}</span>
                      {pdf.showLabel !== false && value ? <span className="block truncate px-1">{value}</span> : null}
                      <button
                        type="button"
                        data-resize="true"
                        aria-label={`Resize ${component.label}`}
                        className="absolute right-0 bottom-0 h-3 w-3 cursor-se-resize bg-accent"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <aside className="grid content-start gap-2 overflow-auto border-l border-line p-3">
          <h2 className="text-sm font-semibold">{selected ? selected.label : "Field"}</h2>
          {selected?.pdf ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs">Page
                <Input aria-label="PDF page" type="number" min={1} max={pageCount} value={selected.pdf.page} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, page: clamp(Number(event.target.value) || 1, 1, pageCount) })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "w", "h"] as const).map((key) => (
                  <label key={key} className="grid gap-1 text-xs uppercase">{key}
                    <Input aria-label={key} type="number" value={Math.round(selected.pdf![key] * 10) / 10} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, [key]: clamp(Number(event.target.value), key === "w" || key === "h" ? 2 : 0, 100) })} />
                  </label>
                ))}
              </div>
              <label className="grid gap-1 text-xs">Font
                <select aria-label="PDF font" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={selected.pdf.font ?? "Helvetica"} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, font: event.target.value as PdfPlacement["font"] })}>
                  <option>Helvetica</option>
                  <option>Helvetica-Bold</option>
                  <option>Helvetica-Oblique</option>
                  <option>Courier</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs">Size
                <Input aria-label="Font size" type="number" min={7} max={28} value={selected.pdf.fontSize ?? 11} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, fontSize: clamp(Number(event.target.value) || 11, 7, 28) })} />
              </label>
              <label className="grid gap-1 text-xs">Align
                <select aria-label="Alignment" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={selected.pdf.align ?? "left"} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, align: event.target.value as PdfPlacement["align"] })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs">Format
                <select aria-label="Value format" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={selected.pdf.format ?? ""} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, format: event.target.value })}>
                  <option value="">As entered</option>
                  <option value="currency">Currency</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="upper">Uppercase</option>
                  <option value="lower">Lowercase</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.pdf.showLabel !== false} onChange={(event) => commitPlacement(selected, { ...selected.pdf!, showLabel: event.target.checked })} />
                Show label
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => shift(selected, -1, 0)}>Left</Button>
                <Button variant="secondary" onClick={() => shift(selected, 1, 0)}>Right</Button>
                <Button variant="secondary" onClick={() => shift(selected, 0, -1)}>Up</Button>
                <Button variant="secondary" onClick={() => shift(selected, 0, 1)}>Down</Button>
                <Button variant="danger" onClick={() => commitPlacement(selected, undefined)}>Unplace</Button>
              </div>
            </div>
          ) : <p className="text-sm text-muted">Select a box. Drag it, resize from the corner, or use the arrow keys. Delete takes it off the page.</p>}
          <h2 className="mt-3 text-sm font-semibold">Sample answers</h2>
          <textarea aria-label="Sample answers JSON" className="h-40 w-full rounded-md border border-line bg-elevated p-2 font-mono text-xs" value={sampleText} onChange={(event) => setSampleText(event.target.value)} />
          {sample ? null : <p className="text-xs text-danger">Sample JSON is invalid, so the filled PDF cannot be built.</p>}
          <Button variant="ghost" onClick={() => setSampleText(JSON.stringify(sampleSubmission(form.components), null, 2))}>Reset sample</Button>
          <p className="text-xs text-muted">{form.settings.pdf?.fileName ? `Background: ${form.settings.pdf.fileName}.` : "No background uploaded. The download is a letter page."} Filled downloads also append a text record of every answer. Overlay export uses Form.io page, left, top, width, and height in pixels.</p>
        </aside>
      </div>
    </div>
  );
}
