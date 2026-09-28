import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowDef } from "../forms/types.ts";
import { validateWorkflow } from "./graph.ts";

const sound: WorkflowDef = {
  nodes: [
    { id: "s", type: "start", title: "Start" },
    { id: "p", type: "parallel", title: "Split" },
    { id: "a", type: "human", title: "Legal", role: "Counsel" },
    { id: "b", type: "human", title: "Finance", role: "Controller" },
    { id: "j", type: "join", title: "Join", join: "all" },
    { id: "e", type: "end", title: "End" },
  ],
  edges: [
    { from: "s", to: "p" },
    { from: "p", to: "a" },
    { from: "p", to: "b" },
    { from: "a", to: "j" },
    { from: "b", to: "j" },
    { from: "j", to: "e" },
  ],
};

test("a complete parallel workflow has no issues", () => {
  assert.deepEqual(validateWorkflow(sound), []);
});

test("unreachable nodes, private urls and n-of-m joins are rejected", () => {
  const broken: WorkflowDef = {
    nodes: [
      { id: "s", type: "start", title: "Start" },
      { id: "h", type: "http", title: "Call", url: "http://169.254.169.254/latest" },
      { id: "j", type: "join", title: "Join", join: "n" },
      { id: "z", type: "end", title: "Orphan" },
      { id: "e", type: "end", title: "End" },
    ],
    edges: [
      { from: "s", to: "h" },
      { from: "h", to: "j" },
      { from: "j", to: "e" },
    ],
  };
  const codes = validateWorkflow(broken).map((issue) => issue.code);
  assert.ok(codes.includes("SSRF"));
  assert.ok(codes.includes("JOIN_COUNT"));
  assert.ok(codes.includes("UNREACHABLE"));
});
