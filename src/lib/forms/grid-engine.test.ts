import assert from "node:assert/strict";
import test from "node:test";
import { applyRowFormulas, columnAggregate, filterRows, formulaOrder, fromCsv, pasteBlock, reorderRow, sortRows, toCsv, validateCrossRow, visibleWindow, type GridColumn, type GridRow } from "./grid-engine.ts";

const columns: GridColumn[] = [
  { key: "qty", label: "Qty", type: "number" },
  { key: "price", label: "Price", type: "number" },
  { key: "line", label: "Line", type: "number", formula: "qty * price" },
];

test("grid sorts stably and filters", () => {
  const rows: GridRow[] = [{ qty: 2, name: "b" }, { qty: 1, name: "a" }, { qty: 2, name: "a" }];
  const sorted = sortRows(rows, "qty", "asc");
  assert.equal(sorted[0]?.name, "a");
  assert.equal(sorted[1]?.name, "b");
  assert.equal(sorted[2]?.name, "a");
  assert.deepEqual(filterRows(rows, "A", ["name"]).map((row) => row.name), ["a", "a"]);
});

test("grid paste, totals, formulas and cycles", () => {
  const pasted = pasteBlock([], columns, 0, 0, "2\t5\n3\t4");
  assert.equal(pasted[1]?.price, 4);
  const calculated = applyRowFormulas(pasted[0] ?? {}, columns, pasted);
  assert.equal(calculated.row.line, 10);
  assert.equal(columnAggregate([{ line: 10 }, { line: 20 }], "line", "sum"), 30);
  const cycle = formulaOrder([
    { key: "a", label: "A", type: "number", formula: "b + 1" },
    { key: "b", label: "B", type: "number", formula: "a + 1" },
  ]);
  assert.equal(cycle.cycles.length, 2);
});

test("grid reorder, csv and virtual window", () => {
  const moved = reorderRow([{ id: "a" }, { id: "b" }, { id: "c" }], 0, 2);
  assert.equal(moved[2]?.id, "a");
  const csv = toCsv(columns, [{ qty: 1, price: 2, line: null }]);
  const parsed = fromCsv(`"name","note"\n"a,b","say ""hi"""`);
  assert.equal(parsed.rows[0]?.name, "a,b");
  assert.equal(parsed.rows[0]?.note, 'say "hi"');
  assert.match(csv, /Qty,Price,Line/);
  const window = visibleWindow(10_000, 500, 200, 20, 2);
  assert.ok(window.end - window.start < 40);
  assert.equal(window.totalHeight, 200_000);
  const issues = validateCrossRow([{ qty: 0 }], [{ expression: "row.qty > 0", message: "Qty required" }]);
  assert.equal(issues[0]?.message, "Qty required");
});
