/**
 * Visual PDF template editor state.
 * Coordinates are page-normalized (0..1), origin top-left, independent of zoom.
 */

export const PDF_FIELD_TYPES = [
  "text",
  "multiline",
  "number",
  "currency",
  "date",
  "checkbox",
  "radio",
  "select",
  "signature",
  "initials",
  "image",
  "stamp",
] as const;

export type PdfFieldType = (typeof PDF_FIELD_TYPES)[number];
export type Align = "left" | "center" | "right";
export type FitMode = "custom" | "width" | "page";
export type ViewRotation = 0 | 90 | 180 | 270;

export interface Placement {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  componentKey: string;
  pdfFieldType: PdfFieldType;
  font: string;
  fontSize: number;
  align: Align;
  format: string;
  required: boolean;
}

export interface EditorDoc {
  templateId: string;
  version: number;
  pageCount: number;
  placements: Placement[];
  zoom: number;
  fit: FitMode;
  viewRotation: ViewRotation;
  snap: boolean;
  grid: number;
}

export interface EditorState {
  present: EditorDoc;
  past: EditorDoc[];
  future: EditorDoc[];
  selected: string[];
  clipboard: Placement[];
}

export type AlignEdge = "left" | "right" | "top" | "bottom" | "center-x" | "center-y";

const HISTORY = 80;

function clamp(n: number, min = 0, max = 1): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function snapTo(value: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return value;
  return clamp(Math.round(value / grid) * grid);
}

function cloneDoc(doc: EditorDoc): EditorDoc {
  return { ...doc, placements: doc.placements.map((item) => ({ ...item })) };
}

export function blankDoc(templateId: string, pageCount = 1): EditorDoc {
  return {
    templateId,
    version: 1,
    pageCount: Math.max(1, pageCount),
    placements: [],
    zoom: 1,
    fit: "width",
    viewRotation: 0,
    snap: true,
    grid: 0.01,
  };
}

export function createEditor(doc?: Partial<EditorDoc> & { templateId: string }): EditorState {
  const present = { ...blankDoc(doc?.templateId ?? "tpl"), ...doc, placements: doc?.placements?.map((item) => ({ ...item })) ?? [] };
  return { present, past: [], future: [], selected: [], clipboard: [] };
}

function commit(state: EditorState, present: EditorDoc, selected = state.selected): EditorState {
  return {
    present,
    past: [...state.past, cloneDoc(state.present)].slice(-HISTORY),
    future: [],
    selected,
    clipboard: state.clipboard,
  };
}

function touch(state: EditorState, present: EditorDoc): EditorState {
  return { ...state, present };
}

let seq = 0;
export function nextPlacementId(): string {
  seq += 1;
  return `ov_${seq.toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

export function isPdfFieldType(value: string): value is PdfFieldType {
  return (PDF_FIELD_TYPES as readonly string[]).includes(value);
}

export function createPlacement(partial: Partial<Placement> & { page: number; componentKey: string }): Placement {
  const type = partial.pdfFieldType && isPdfFieldType(partial.pdfFieldType) ? partial.pdfFieldType : "text";
  const w = partial.w ?? (type === "checkbox" ? 0.03 : 0.28);
  const h = partial.h ?? (type === "multiline" || type === "signature" || type === "image" ? 0.08 : 0.035);
  return {
    id: partial.id ?? nextPlacementId(),
    page: partial.page,
    x: clamp(partial.x ?? 0.1),
    y: clamp(partial.y ?? 0.1),
    w: clamp(w, 0.01, 1),
    h: clamp(h, 0.01, 1),
    rotation: partial.rotation ?? 0,
    componentKey: partial.componentKey,
    pdfFieldType: type,
    font: partial.font ?? "Helvetica",
    fontSize: partial.fontSize ?? 11,
    align: partial.align ?? "left",
    format: partial.format ?? "",
    required: partial.required ?? false,
  };
}

function byId(doc: EditorDoc, id: string): Placement | undefined {
  return doc.placements.find((item) => item.id === id);
}

export function boundsOf(items: Placement[]): { x: number; y: number; r: number; b: number } | null {
  if (!items.length) return null;
  const x = Math.min(...items.map((item) => item.x));
  const y = Math.min(...items.map((item) => item.y));
  const r = Math.max(...items.map((item) => item.x + item.w));
  const b = Math.max(...items.map((item) => item.y + item.h));
  return { x, y, r, b };
}

/** Inverse-rotate a point around the placement center so hit tests honor rotation. */
export function hitTest(doc: EditorDoc, page: number, x: number, y: number): Placement | null {
  const onPage = doc.placements.filter((item) => item.page === page);
  for (let i = onPage.length - 1; i >= 0; i -= 1) {
    const item = onPage[i]!;
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const rad = (-item.rotation * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
    if (lx >= item.x && lx <= item.x + item.w && ly >= item.y && ly <= item.y + item.h) return item;
  }
  return null;
}

export function intersects(a: Placement, rect: { x: number; y: number; w: number; h: number }): boolean {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = rect.x + rect.w;
  const by2 = rect.y + rect.h;
  return a.x < bx2 && ax2 > rect.x && a.y < by2 && ay2 > rect.y;
}

export function selectInRect(doc: EditorDoc, page: number, rect: { x: number; y: number; w: number; h: number }): string[] {
  const box = { x: Math.min(rect.x, rect.x + rect.w), y: Math.min(rect.y, rect.y + rect.h), w: Math.abs(rect.w), h: Math.abs(rect.h) };
  return doc.placements.filter((item) => item.page === page && intersects(item, box)).map((item) => item.id);
}

function replace(doc: EditorDoc, placements: Placement[]): EditorDoc {
  return { ...doc, placements };
}

function mapSelected(doc: EditorDoc, ids: string[], fn: (item: Placement) => Placement): EditorDoc {
  const set = new Set(ids);
  return replace(doc, doc.placements.map((item) => (set.has(item.id) ? fn(item) : item)));
}

export function addPlacement(state: EditorState, partial: Partial<Placement> & { page: number; componentKey: string }): EditorState {
  const item = createPlacement(partial);
  if (item.page < 0 || item.page >= state.present.pageCount) return state;
  const snapped = {
    ...item,
    x: snapTo(item.x, state.present.grid, state.present.snap),
    y: snapTo(item.y, state.present.grid, state.present.snap),
  };
  return commit(state, replace(state.present, [...state.present.placements, snapped]), [snapped.id]);
}

export function movePlacements(state: EditorState, ids: string[], dx: number, dy: number): EditorState {
  const set = new Set(ids);
  const moving = state.present.placements.filter((item) => set.has(item.id));
  if (!moving.length) return state;
  const next = moving.map((item) => ({
    ...item,
    x: snapTo(clamp(item.x + dx, 0, 1 - item.w), state.present.grid, state.present.snap),
    y: snapTo(clamp(item.y + dy, 0, 1 - item.h), state.present.grid, state.present.snap),
  }));
  const by = new Map(next.map((item) => [item.id, item]));
  return commit(state, replace(state.present, state.present.placements.map((item) => by.get(item.id) ?? item)));
}

export function resizePlacement(state: EditorState, id: string, box: { x: number; y: number; w: number; h: number }): EditorState {
  const item = byId(state.present, id);
  if (!item) return state;
  const w = clamp(Math.max(0.01, box.w), 0.01, 1);
  const h = clamp(Math.max(0.01, box.h), 0.01, 1);
  const x = snapTo(clamp(box.x, 0, 1 - w), state.present.grid, state.present.snap);
  const y = snapTo(clamp(box.y, 0, 1 - h), state.present.grid, state.present.snap);
  return commit(state, mapSelected(state.present, [id], () => ({ ...item, x, y, w, h })));
}

export function nudge(state: EditorState, ids: string[], dir: "left" | "right" | "up" | "down", fine = false): EditorState {
  const step = fine ? state.present.grid / 5 : state.present.grid || 0.01;
  const dx = dir === "left" ? -step : dir === "right" ? step : 0;
  const dy = dir === "up" ? -step : dir === "down" ? step : 0;
  const forced = { ...state, present: { ...state.present, snap: true, grid: step } };
  return movePlacements(forced, ids, dx, dy);
}

export function deletePlacements(state: EditorState, ids: string[]): EditorState {
  const set = new Set(ids);
  if (!state.present.placements.some((item) => set.has(item.id))) return state;
  return commit(
    state,
    replace(state.present, state.present.placements.filter((item) => !set.has(item.id))),
    state.selected.filter((id) => !set.has(id)),
  );
}

export function copyPlacements(state: EditorState, ids: string[]): EditorState {
  const set = new Set(ids);
  const clipboard = state.present.placements.filter((item) => set.has(item.id)).map((item) => ({ ...item }));
  if (!clipboard.length) return state;
  return { ...state, clipboard };
}

export function pastePlacements(state: EditorState, page: number): EditorState {
  if (!state.clipboard.length) return state;
  const copies = state.clipboard.map((item) => createPlacement({
    ...item,
    id: undefined,
    page,
    x: clamp(item.x + 0.02, 0, 1 - item.w),
    y: clamp(item.y + 0.02, 0, 1 - item.h),
  }));
  return commit(state, replace(state.present, [...state.present.placements, ...copies]), copies.map((item) => item.id));
}

export function duplicatePlacements(state: EditorState, ids: string[]): EditorState {
  const copied = copyPlacements(state, ids);
  const page = byId(copied.present, ids[0] ?? "")?.page ?? 0;
  return pastePlacements(copied, page);
}

export function alignPlacements(state: EditorState, ids: string[], edge: AlignEdge): EditorState {
  const items = state.present.placements.filter((item) => ids.includes(item.id) && item.page === state.present.placements.find((p) => p.id === ids[0])?.page);
  const box = boundsOf(items);
  if (!box || items.length < 2) return state;
  return commit(state, mapSelected(state.present, items.map((item) => item.id), (item) => {
    if (edge === "left") return { ...item, x: box.x };
    if (edge === "right") return { ...item, x: box.r - item.w };
    if (edge === "top") return { ...item, y: box.y };
    if (edge === "bottom") return { ...item, y: box.b - item.h };
    if (edge === "center-x") return { ...item, x: clamp((box.x + box.r) / 2 - item.w / 2, 0, 1 - item.w) };
    return { ...item, y: clamp((box.y + box.b) / 2 - item.h / 2, 0, 1 - item.h) };
  }));
}

export function distribute(state: EditorState, ids: string[], axis: "horizontal" | "vertical"): EditorState {
  const page = state.present.placements.find((item) => item.id === ids[0])?.page;
  const items = state.present.placements.filter((item) => ids.includes(item.id) && item.page === page);
  if (items.length < 3) return state;
  const sorted = [...items].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = axis === "horizontal" ? last.x - first.x : last.y - first.y;
  const step = span / (sorted.length - 1);
  const next = new Map(sorted.map((item, index) => {
    const pos = (axis === "horizontal" ? first.x : first.y) + step * index;
    return [item.id, axis === "horizontal" ? { ...item, x: clamp(pos, 0, 1 - item.w) } : { ...item, y: clamp(pos, 0, 1 - item.h) }];
  }));
  return commit(state, replace(state.present, state.present.placements.map((item) => next.get(item.id) ?? item)));
}

export function setSelection(state: EditorState, ids: string[], mode: "replace" | "toggle" | "add" = "replace"): EditorState {
  const known = new Set(state.present.placements.map((item) => item.id));
  const clean = ids.filter((id) => known.has(id));
  if (mode === "replace") return { ...state, selected: clean };
  if (mode === "add") return { ...state, selected: [...new Set([...state.selected, ...clean])] };
  const set = new Set(state.selected);
  for (const id of clean) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }
  return { ...state, selected: [...set] };
}

export function updatePlacement(state: EditorState, id: string, patch: Partial<Omit<Placement, "id">>): EditorState {
  if (!byId(state.present, id)) return state;
  return commit(state, mapSelected(state.present, [id], (item) => {
    const next = { ...item, ...patch, id: item.id };
    next.x = clamp(next.x, 0, 1 - next.w);
    next.y = clamp(next.y, 0, 1 - next.h);
    next.w = clamp(next.w, 0.01, 1);
    next.h = clamp(next.h, 0.01, 1);
    if (!isPdfFieldType(next.pdfFieldType)) next.pdfFieldType = item.pdfFieldType;
    return next;
  }));
}

export function setView(state: EditorState, patch: Partial<Pick<EditorDoc, "zoom" | "fit" | "viewRotation" | "snap" | "grid">>): EditorState {
  const zoom = patch.zoom == null ? state.present.zoom : clamp(patch.zoom, 0.25, 4);
  const grid = patch.grid == null ? state.present.grid : clamp(patch.grid, 0.001, 0.2);
  const viewRotation = patch.viewRotation ?? state.present.viewRotation;
  return touch(state, { ...state.present, ...patch, zoom, grid, viewRotation });
}

export function undo(state: EditorState): EditorState {
  const previous = state.past[state.past.length - 1];
  if (!previous) return state;
  return {
    present: cloneDoc(previous),
    past: state.past.slice(0, -1),
    future: [cloneDoc(state.present), ...state.future].slice(0, HISTORY),
    selected: state.selected.filter((id) => previous.placements.some((item) => item.id === id)),
    clipboard: state.clipboard,
  };
}

export function redo(state: EditorState): EditorState {
  const next = state.future[0];
  if (!next) return state;
  return {
    present: cloneDoc(next),
    past: [...state.past, cloneDoc(state.present)].slice(-HISTORY),
    future: state.future.slice(1),
    selected: state.selected.filter((id) => next.placements.some((item) => item.id === id)),
    clipboard: state.clipboard,
  };
}

/** New template bytes become the next version. Placements on dropped pages are removed. */
export function bumpTemplateVersion(state: EditorState, pageCount: number): EditorState {
  const pages = Math.max(1, pageCount);
  const placements = state.present.placements.filter((item) => item.page < pages);
  return commit(state, { ...state.present, version: state.present.version + 1, pageCount: pages, placements }, []);
}

export function placementsOnPage(doc: EditorDoc, page: number): Placement[] {
  return doc.placements.filter((item) => item.page === page);
}

export interface OverlayRow {
  id: string;
  templateId: string;
  templateVersion: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  componentKey: string;
  pdfFieldType: string;
  font: string;
  fontSize: number;
  alignment: string;
  format: string | null;
  required: boolean;
}

export function toOverlayRows(doc: EditorDoc): OverlayRow[] {
  return doc.placements.map((item) => ({
    id: item.id,
    templateId: doc.templateId,
    templateVersion: doc.version,
    page: item.page,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    rotation: item.rotation,
    componentKey: item.componentKey,
    pdfFieldType: item.pdfFieldType,
    font: item.font,
    fontSize: item.fontSize,
    alignment: item.align,
    format: item.format || null,
    required: item.required,
  }));
}

export function fromOverlayRows(templateId: string, version: number, pageCount: number, rows: OverlayRow[]): EditorDoc {
  return {
    ...blankDoc(templateId, pageCount),
    version,
    placements: rows.map((row) => createPlacement({
      id: row.id,
      page: row.page,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      rotation: row.rotation,
      componentKey: row.componentKey,
      pdfFieldType: isPdfFieldType(row.pdfFieldType) ? row.pdfFieldType : "text",
      font: row.font,
      fontSize: row.fontSize,
      align: row.alignment === "center" || row.alignment === "right" ? row.alignment : "left",
      format: row.format ?? "",
      required: row.required,
    })),
  };
}

/** Viewport pixels from a normalized box. Rotation of the view is applied by the caller via CSS. */
export function boxToPixels(item: Pick<Placement, "x" | "y" | "w" | "h">, pageWidth: number, pageHeight: number): { left: number; top: number; width: number; height: number } {
  return {
    left: item.x * pageWidth,
    top: item.y * pageHeight,
    width: item.w * pageWidth,
    height: item.h * pageHeight,
  };
}

export function pixelsToBox(left: number, top: number, width: number, height: number, pageWidth: number, pageHeight: number): { x: number; y: number; w: number; h: number } {
  return {
    x: pageWidth ? left / pageWidth : 0,
    y: pageHeight ? top / pageHeight : 0,
    w: pageWidth ? width / pageWidth : 0,
    h: pageHeight ? height / pageHeight : 0,
  };
}
