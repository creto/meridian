import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowDef, WorkflowNode } from "../forms/types.ts";
import {
  addNode,
  connect,
  createEditorState,
  createEmptyWorkflow,
  disconnect,
  redo,
  removeNode,
  setJoin,
  undo,
  updateNode,
  validateEditor,
  type EditorState,
} from "./editor-model.ts";

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value as object)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

function must(state: { ok: true; state: EditorState } | { ok: false; reason: string }): EditorState {
  if (!state.ok) assert.fail(state.reason);
  return state.state;
}

test("empty workflow validates and commands do not mutate input", () => {
  const empty = createEmptyWorkflow();
  assert.deepEqual(empty.nodes.map((node) => node.type), ["start", "end"]);
  assert.deepEqual(empty.edges, [{ from: "start", to: "end" }]);
  assert.deepEqual(validateEditor(empty), []);

  const seeded = createEmptyWorkflow();
  const state = createEditorState(seeded);
  seeded.nodes.pop();
  assert.equal(state.present.nodes.length, 2);

  const frozen = freeze(structuredClone(state));
  const node: WorkflowNode = { id: "review", type: "human", title: "Review", role: "clerk" };
  const added = addNode(frozen, node);
  node.title = "changed";
  assert.equal(frozen.present.nodes.length, 2);
  assert.equal(frozen.past.length, 0);
  const next = must(added);
  assert.equal(next.present.nodes.find((item) => item.id === "review")?.title, "Review");
  assert.equal(next.past.length, 1);
  assert.deepEqual(next.future, []);
  assert.deepEqual(next.past[0], empty);

  const duplicate = addNode(next, { id: "review", type: "human", title: "Again" });
  assert.deepEqual(duplicate, { ok: false, reason: "duplicate node id" });
  assert.equal(next.present.nodes.filter((item) => item.id === "review").length, 1);
});

test("connect, disconnect, join, and remove enforce graph rules", () => {
  let state = createEditorState();
  assert.deepEqual(connect(state, { from: "start", to: "start" }), { ok: false, reason: "self-loop" });
  assert.deepEqual(connect(state, { from: "start", to: "missing" }), { ok: false, reason: "unknown node: missing" });
  assert.deepEqual(connect(state, { from: "start", to: "end" }), { ok: false, reason: "duplicate edge" });
  assert.equal(state.past.length, 0);

  state = must(addNode(state, { id: "review", type: "human", title: "Review" }));
  state = must(connect(state, { from: "start", to: "review", when: "approved" }));
  state = must(disconnect(state, "start", "end"));
  state = must(connect(state, { from: "review", to: "end" }));
  assert.deepEqual(state.present.edges, [
    { from: "start", to: "review", when: "approved" },
    { from: "review", to: "end" },
  ]);
  assert.deepEqual(disconnect(state, "review", "missing"), { ok: false, reason: "edge not found" });

  state = must(updateNode(state, "review", { title: "Clerk review", role: "clerk" }));
  assert.equal(state.present.nodes.find((node) => node.id === "review")?.title, "Clerk review");
  assert.deepEqual(updateNode(state, "review", { id: "other" }), { ok: false, reason: "cannot change node id" });
  assert.deepEqual(updateNode(state, "nope", { title: "x" }), { ok: false, reason: "unknown node" });

  state = must(addNode(state, { id: "gate", type: "join", title: "Gate" }));
  assert.deepEqual(setJoin(state, "gate", "n"), { ok: false, reason: "joinCount required" });
  assert.deepEqual(setJoin(state, "gate", "nope" as "all"), { ok: false, reason: "invalid join" });
  state = must(setJoin(state, "gate", "n", 2));
  assert.equal(state.present.nodes.find((node) => node.id === "gate")?.join, "n");
  assert.equal(state.present.nodes.find((node) => node.id === "gate")?.joinCount, 2);
  state = must(setJoin(state, "gate", "all"));
  const gate = state.present.nodes.find((node) => node.id === "gate");
  assert.equal(gate?.join, "all");
  assert.equal(gate?.joinCount, undefined);

  assert.deepEqual(removeNode(state, "start"), { ok: false, reason: "cannot remove the last start" });
  assert.deepEqual(removeNode(state, "end"), { ok: false, reason: "cannot remove the last end" });
  assert.deepEqual(removeNode(state, "missing"), { ok: false, reason: "unknown node" });
  const beforeRemove = structuredClone(state);
  state = must(removeNode(state, "review"));
  assert.equal(state.present.nodes.some((node) => node.id === "review"), false);
  assert.equal(state.present.edges.some((edge) => edge.from === "review" || edge.to === "review"), false);
  assert.notDeepEqual(state, beforeRemove);

  state = must(addNode(state, { id: "start2", type: "start", title: "Also start" }));
  state = must(addNode(state, { id: "end2", type: "end", title: "Also end" }));
  state = must(removeNode(state, "start"));
  state = must(removeNode(state, "end2"));
  assert.equal(state.present.nodes.filter((node) => node.type === "start").length, 1);
  assert.equal(state.present.nodes.some((node) => node.id === "end"), true);
  assert.deepEqual(removeNode(state, "start2"), { ok: false, reason: "cannot remove the last start" });
  assert.deepEqual(removeNode(state, "end"), { ok: false, reason: "cannot remove the last end" });
});

test("undo and redo honor a 50-step history and clear the future", () => {
  let state = createEditorState();
  assert.deepEqual(undo(state), { ok: false, reason: "nothing to undo" });
  for (let i = 0; i < 51; i += 1) {
    state = must(addNode(state, { id: `n${i}`, type: "human", title: `N${i}` }));
  }
  assert.equal(state.past.length, 50);
  assert.equal(state.present.nodes.some((node) => node.id === "n50"), true);
  const undone = must(undo(state));
  undone.present.nodes[0]!.title = "hacked";
  const redone = must(redo(undone));
  assert.equal(redone.present.nodes[0]?.title, "Start");
  assert.equal(redone.present.nodes.some((node) => node.id === "n50"), true);

  let steps = 0;
  let cursor = state;
  while (cursor.past.length > 0) {
    cursor = must(undo(cursor));
    steps += 1;
  }
  assert.equal(steps, 50);
  assert.equal(undo(cursor).ok, false);
  assert.equal(cursor.present.nodes.some((node) => node.id === "n0"), true);
  assert.equal(cursor.present.nodes.some((node) => node.id === "n50"), false);

  const branched = must(addNode(cursor, { id: "extra", type: "human", title: "Extra" }));
  assert.deepEqual(branched.future, []);
  assert.deepEqual(redo(branched), { ok: false, reason: "nothing to redo" });
  const back = must(undo(branched));
  assert.equal(back.present.nodes.some((node) => node.id === "extra"), false);
  const forward = must(redo(back));
  assert.equal(forward.present.nodes.some((node) => node.id === "extra"), true);
});

test("validateEditor reports structural problems", () => {
  const def: WorkflowDef = {
    nodes: [
      { id: "start", type: "start", title: "Start" },
      { id: "end", type: "end", title: "End" },
      { id: "pdf", type: "service", title: "PDF", service: "pdf" },
      { id: "hook", type: "service", title: "Hook", service: "webhook", url: " " },
      { id: "call", type: "http", title: "Call", url: "https://example.com/hook" },
      { id: "bare", type: "webhook", title: "Bare" },
      { id: "join", type: "join", title: "Join", join: "all" },
      { id: "orphan", type: "human", title: "Orphan" },
    ],
    edges: [
      { from: "start", to: "pdf" },
      { from: "pdf", to: "call" },
      { from: "call", to: "end" },
      { from: "missing", to: "end" },
      { from: "start", to: "ghost" },
    ],
  };
  const issues = validateEditor(def);
  const codes = (id?: string) => issues.filter((issue) => issue.nodeId === id).map((issue) => issue.code);
  assert.deepEqual(codes("missing"), ["unknown-edge"]);
  assert.deepEqual(codes("ghost"), ["unknown-edge"]);
  assert.ok(codes("hook").includes("unreachable"));
  assert.ok(codes("hook").includes("missing-url"));
  assert.ok(codes("bare").includes("missing-url"));
  assert.ok(codes("join").includes("unreachable"));
  assert.ok(codes("join").includes("join-unfed"));
  assert.ok(codes("orphan").includes("unreachable"));
  assert.equal(codes("pdf").length, 0);
  assert.equal(codes("call").length, 0);
  assert.equal(issues.some((issue) => issue.code === "missing-start" || issue.code === "missing-end"), false);

  const noEnds: WorkflowDef = {
    nodes: [{ id: "only", type: "human", title: "Only" }],
    edges: [{ from: "only", to: "gone" }],
  };
  const broken = validateEditor(noEnds);
  assert.ok(broken.some((issue) => issue.code === "missing-start"));
  assert.ok(broken.some((issue) => issue.code === "missing-end"));
  assert.ok(broken.some((issue) => issue.code === "unknown-edge" && issue.nodeId === "gone"));

  const fed: WorkflowDef = {
    nodes: [
      { id: "start", type: "start", title: "Start" },
      { id: "gate", type: "join", title: "Gate", join: "any" },
      { id: "end", type: "end", title: "End" },
      { id: "call", type: "service", title: "Call", service: "http", url: "https://example.com" },
    ],
    edges: [
      { from: "start", to: "gate" },
      { from: "gate", to: "call" },
      { from: "call", to: "end" },
    ],
  };
  assert.deepEqual(validateEditor(fed), []);
});
