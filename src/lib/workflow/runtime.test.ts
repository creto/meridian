import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowDef } from "../forms/types.ts";
import {
  arriveAtJoin,
  cancelRun,
  completeHumanTask,
  reassignTask,
  restoreRun,
  retryNode,
  skipNode,
  snapshotRun,
  startRun,
  step,
  type ServicePorts,
} from "./runtime.ts";

const flow: WorkflowDef = {
  nodes: [
    { id: "start", type: "start", title: "Submitted" },
    { id: "split", type: "parallel", title: "Split" },
    { id: "legal", type: "approval", title: "Legal", role: "Counsel" },
    { id: "wait", type: "timer", title: "Cooling off", delayMs: 1_000 },
    { id: "http", type: "http", title: "Notify", url: "https://example.com/hook" },
    { id: "join", type: "join", title: "All", join: "all" },
    { id: "pdf", type: "service", title: "PDF", service: "pdf" },
    { id: "ecm", type: "service", title: "File", service: "ecm", ecmProfile: "vault" },
    { id: "mail", type: "service", title: "Mail", service: "email", emailTemplate: "approval" },
    { id: "end", type: "end", title: "Done" },
  ],
  edges: [
    { from: "start", to: "split" },
    { from: "split", to: "legal" },
    { from: "split", to: "wait" },
    { from: "split", to: "http" },
    { from: "legal", to: "join", when: "approved" },
    { from: "wait", to: "join" },
    { from: "http", to: "join" },
    { from: "join", to: "pdf" },
    { from: "pdf", to: "ecm" },
    { from: "ecm", to: "mail" },
    { from: "mail", to: "end" },
  ],
};

function ports(now: number, httpOk = true): ServicePorts & { clock: { t: number } } {
  const clock = { t: now };
  return {
    clock,
    now: () => clock.t,
    http: async () => ({ ok: httpOk, status: httpOk ? 200 : 500, body: { echoed: true } }),
    pdf: async () => ({ hash: "pdfhash" }),
    ecm: async () => ({ ref: "ecm-1" }),
    email: async () => ({ queued: true }),
  };
}

test("join releases once when every branch has arrived", () => {
  const first = arriveAtJoin(undefined, ["a", "b"], 2);
  assert.equal(first.released, true);
  const again = arriveAtJoin(first.mark, ["c"], 2);
  assert.equal(again.released, false);
  assert.deepEqual(again.mark.arrived, ["a", "b"]);
});

test("parallel approval, timer, and http join once, then pdf, ecm, and email", async () => {
  const services = ports(0);
  let state = startRun(flow, 0);
  state = await step(state, flow, { data: { vendor: "Northwind" }, services });
  assert.equal(state.status, "WAITING");
  assert.equal(state.tasks.length, 1);
  const task = state.tasks[0]!;
  const moved = reassignTask(state, task.id, "user_ada", "lead", 10);
  assert.equal(moved.ok, true);
  const done = completeHumanTask(state, flow, task.id, "approve", "user_ada", 20);
  assert.equal(done.ok, true);
  const twice = completeHumanTask(state, flow, task.id, "approve", "user_ada", 21);
  assert.equal(twice.ok, false);
  services.clock.t = 5_000;
  state = await step(state, flow, { data: { vendor: "Northwind" }, services });
  assert.equal(state.status, "COMPLETED");
  assert.equal(state.log.filter((event) => event.action === "join-released").length, 1);
  assert.equal((state.outputs.pdf as { hash: string }).hash, "pdfhash");
  assert.equal((state.outputs.ecm as { ref: string }).ref, "ecm-1");
  const raw = snapshotRun(state);
  const restored = restoreRun(raw);
  assert.equal(restored.status, "COMPLETED");
});

test("a failed http node retries, then an operator can skip or cancel", async () => {
  const services = ports(0, false);
  let state = startRun({
    nodes: [
      { id: "start", type: "start", title: "Start" },
      { id: "http", type: "http", title: "Notify", url: "https://example.com/hook", retryLimit: 2 },
      { id: "end", type: "end", title: "End" },
    ],
    edges: [
      { from: "start", to: "http" },
      { from: "http", to: "end" },
    ],
  });
  state = await step(state, flow, { data: {}, services });
  assert.equal(state.status === "RETRYING" || state.status === "DEAD_LETTER", true);
  state = skipNode(state, "http", "ops", "vendor accepted by phone", services.clock.t);
  state = retryNode(state, { nodes: [], edges: [] }, "missing", "ops", 1);
  state = cancelRun(state, "ops", 2);
  assert.equal(state.status, "CANCELLED");
  assert.ok(state.log.some((event) => event.action === "cancel"));
});
