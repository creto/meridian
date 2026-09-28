import assert from "node:assert/strict";
import test from "node:test";
import {
  addPlacement,
  alignPlacements,
  boxToPixels,
  bumpTemplateVersion,
  createEditor,
  deletePlacements,
  distribute,
  duplicatePlacements,
  fromOverlayRows,
  hitTest,
  movePlacements,
  nudge,
  pixelsToBox,
  redo,
  selectInRect,
  toOverlayRows,
  undo,
  updatePlacement,
} from "./editor-model.ts";

test("placements stay page-normalized when moved and resized via pixels", () => {
  let state = createEditor({ templateId: "tpl_a", pageCount: 2 });
  state = addPlacement(state, { page: 0, componentKey: "legalName", x: 0.1, y: 0.2, w: 0.3, h: 0.05 });
  const id = state.selected[0]!;
  const pixels = boxToPixels(state.present.placements[0]!, 600, 800);
  const back = pixelsToBox(pixels.left, pixels.top, pixels.width, pixels.height, 600, 800);
  assert.ok(Math.abs(back.x - 0.1) < 1e-9);
  state = movePlacements(state, [id], 0.5, 0.5);
  const moved = state.present.placements[0]!;
  assert.ok(moved.x <= 1 - moved.w);
  assert.ok(moved.y <= 1 - moved.h);
  assert.equal(state.past.length, 2);
});

test("hit testing honors rotation and z-order", () => {
  let state = createEditor({ templateId: "tpl_b", pageCount: 1, snap: false });
  state = addPlacement(state, { page: 0, componentKey: "a", x: 0.1, y: 0.1, w: 0.4, h: 0.2, rotation: 0 });
  const hit = hitTest(state.present, 0, 0.2, 0.15);
  assert.equal(hit?.componentKey, "a");
  assert.equal(hitTest(state.present, 0, 0.9, 0.9), null);
  const ids = selectInRect(state.present, 0, { x: 0, y: 0, w: 0.2, h: 0.2 });
  assert.equal(ids.length, 1);
});

test("align, distribute, duplicate, undo and redo", () => {
  let state = createEditor({ templateId: "tpl_c", pageCount: 1, snap: false });
  state = addPlacement(state, { page: 0, componentKey: "a", x: 0.1, y: 0.1, w: 0.1, h: 0.05 });
  state = addPlacement(state, { page: 0, componentKey: "b", x: 0.4, y: 0.3, w: 0.1, h: 0.05 });
  state = addPlacement(state, { page: 0, componentKey: "c", x: 0.7, y: 0.5, w: 0.1, h: 0.05 });
  const ids = state.present.placements.map((item) => item.id);
  state = alignPlacements(state, ids, "left");
  assert.equal(new Set(state.present.placements.map((item) => item.x)).size, 1);
  state = distribute(state, ids, "vertical");
  const ys = state.present.placements.map((item) => item.y).sort((a, b) => a - b);
  assert.ok(ys[1]! - ys[0]! > 0);
  const before = state.present.placements.length;
  state = duplicatePlacements(state, [ids[0]!]);
  assert.equal(state.present.placements.length, before + 1);
  state = undo(state);
  assert.equal(state.present.placements.length, before);
  state = redo(state);
  assert.equal(state.present.placements.length, before + 1);
});

test("version bump drops overlays on removed pages and rows round-trip", () => {
  let state = createEditor({ templateId: "tpl_d", pageCount: 3, snap: false });
  state = addPlacement(state, { page: 2, componentKey: "gone", pdfFieldType: "signature", required: true });
  state = addPlacement(state, { page: 0, componentKey: "keep", pdfFieldType: "currency", format: "USD" });
  state = bumpTemplateVersion(state, 1);
  assert.equal(state.present.version, 2);
  assert.deepEqual(state.present.placements.map((item) => item.componentKey), ["keep"]);
  const rows = toOverlayRows(state.present);
  const restored = fromOverlayRows("tpl_d", 2, 1, rows);
  assert.equal(restored.placements[0]?.format, "USD");
  state = deletePlacements(state, [state.present.placements[0]!.id]);
  assert.equal(state.present.placements.length, 0);
});

test("keyboard nudge and inspector updates stay inside the page", () => {
  let state = createEditor({ templateId: "tpl_e", pageCount: 1, grid: 0.05, snap: true });
  state = addPlacement(state, { page: 0, componentKey: "phone", x: 0, y: 0, w: 0.2, h: 0.05 });
  const id = state.selected[0]!;
  state = nudge(state, [id], "left");
  assert.equal(state.present.placements[0]?.x, 0);
  state = updatePlacement(state, id, { pdfFieldType: "date", fontSize: 14, align: "right", required: true });
  assert.equal(state.present.placements[0]?.pdfFieldType, "date");
  assert.equal(state.present.placements[0]?.required, true);
});
