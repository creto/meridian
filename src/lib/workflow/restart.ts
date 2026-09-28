import type { WorkflowDef } from "../forms/types.ts";
import {
  completeHumanTask,
  restoreRun,
  snapshotRun,
  startRun,
  step,
  type RunState,
  type ServicePorts,
} from "./runtime.ts";

/** The closure acceptance graph: parallel approval, timer, and HTTP, then one join, PDF, ECM, email, end. */
export function acceptanceWorkflow(): WorkflowDef {
  return {
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
      { id: "hook", type: "webhook", title: "Webhook", url: "https://example.com/done" },
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
      { from: "mail", to: "hook" },
      { from: "hook", to: "end" },
    ],
  };
}

export interface AcceptanceProof {
  status: RunState["status"];
  pdf: unknown;
  ecm: unknown;
  email: unknown;
  webhook: unknown;
  resumedFrom: string;
  joinReleases: number;
}

export interface AcceptancePorts extends ServicePorts {
  clock: { t: number };
  calls: { http: number; pdf: number; ecm: number; email: number };
}

export function acceptancePorts(now = 0): AcceptancePorts {
  const clock = { t: now };
  const calls = { http: 0, pdf: 0, ecm: 0, email: 0 };
  return {
    clock,
    calls,
    now: () => clock.t,
    http: async () => {
      calls.http += 1;
      return { ok: true, status: 200, body: { echoed: true } };
    },
    pdf: async () => {
      calls.pdf += 1;
      return { hash: "pdfhash" };
    },
    ecm: async () => {
      calls.ecm += 1;
      return { ref: "ecm-1" };
    },
    email: async () => {
      calls.email += 1;
      return { queued: true };
    },
  };
}

/**
 * Run the acceptance flow and stop while the human task is open.
 * The returned snapshot is what a worker would reload after a process restart.
 */
export async function pauseForRestart(data: Record<string, unknown>, ports: AcceptancePorts): Promise<{ state: RunState; raw: string }> {
  const def = acceptanceWorkflow();
  let state = startRun(def, ports.now());
  state = await step(state, def, { data, services: ports });
  if (state.status !== "WAITING") throw new Error(`Expected WAITING before restart, got ${state.status}`);
  if (state.tasks.length !== 1) throw new Error("Expected one open human task before restart");
  return { state, raw: snapshotRun(state) };
}

/** Restore a snapshot, complete the approval, advance the timer, and finish the graph once. */
export async function resumeAfterRestart(raw: string, data: Record<string, unknown>, ports: AcceptancePorts): Promise<AcceptanceProof> {
  const def = acceptanceWorkflow();
  let state = restoreRun(raw);
  const task = state.tasks.find((item) => item.status === "open" || item.status === "claimed");
  if (!task) throw new Error("Restored run has no open task");
  const done = completeHumanTask(state, def, task.id, "approve", "user_ada", ports.now());
  if (!done.ok) throw new Error(done.code);
  ports.clock.t += 5_000;
  state = await step(state, def, { data, services: ports });
  const joinReleases = state.log.filter((event) => event.action === "join-released").length;
  return {
    status: state.status,
    pdf: state.outputs.pdf,
    ecm: state.outputs.ecm,
    email: state.outputs.mail,
    webhook: state.outputs.hook,
    resumedFrom: raw,
    joinReleases,
  };
}
