/**
 * Durable workflow interpreter.
 * State is JSON, so a worker can stop and resume by calling step() again.
 * Join release is single-shot: two branches arriving together continue once.
 */
import { evalBool } from "../forms/expressions.ts";
import type { WorkflowDef, WorkflowNode } from "../forms/types.ts";
import { serviceBackoff } from "./durable-runtime.ts";

export type RunStatus =
  | "RUNNING"
  | "WAITING"
  | "RETRYING"
  | "FAILED"
  | "DEAD_LETTER"
  | "MANUAL_INTERVENTION"
  | "CANCELLED"
  | "COMPLETED";

export interface RunToken {
  id: string;
  nodeId: string;
  branchId: string;
  status: "active" | "waiting" | "done";
  wakeAt?: number;
}

export interface HumanTask {
  id: string;
  nodeId: string;
  branchId: string;
  role: string;
  assignee?: string;
  status: "open" | "claimed" | "done" | "cancelled";
  decision?: "approve" | "reject" | "changes";
}

export interface JoinMark {
  arrived: string[];
  released: boolean;
}

export interface RunEvent {
  at: number;
  actor: string;
  action: string;
  nodeId?: string;
  detail?: string;
}

export interface RunState {
  status: RunStatus;
  tokens: RunToken[];
  tasks: HumanTask[];
  joins: Record<string, JoinMark>;
  attempts: Record<string, number>;
  skipped: string[];
  outputs: Record<string, unknown>;
  log: RunEvent[];
  seq: number;
}

export interface ServicePorts {
  now: () => number;
  http?: (url: string, body: unknown) => Promise<{ ok: boolean; status: number; body?: unknown }>;
  pdf?: (data: unknown) => Promise<{ hash: string }>;
  archive?: (data: unknown) => Promise<{ ref: string }>;
  storage?: (data: unknown) => Promise<{ ref: string }>;
  ecm?: (profile: string | undefined, data: unknown) => Promise<{ ref: string }>;
  email?: (template: string | undefined, data: unknown) => Promise<{ queued: boolean }>;
  ai?: (instruction: string | undefined, data: unknown) => Promise<{ text: string }>;
}

export interface StepContext {
  data: Record<string, unknown>;
  services: ServicePorts;
  actor?: string;
}

function id(prefix: string, seq: number): string {
  return `${prefix}_${seq}`;
}

export function emptyRun(): RunState {
  return { status: "RUNNING", tokens: [], tasks: [], joins: {}, attempts: {}, skipped: [], outputs: {}, log: [], seq: 1 };
}

export function startRun(def: WorkflowDef, at = 0): RunState {
  const start = def.nodes.find((node) => node.type === "start");
  const state = emptyRun();
  if (!start) {
    state.status = "FAILED";
    state.log.push({ at, actor: "system", action: "start-missing" });
    return state;
  }
  state.tokens.push({ id: id("tok", state.seq), nodeId: start.id, branchId: "main", status: "active" });
  state.seq += 1;
  state.log.push({ at, actor: "system", action: "started", nodeId: start.id });
  return state;
}

function nodeOf(def: WorkflowDef, nodeId: string): WorkflowNode | undefined {
  return def.nodes.find((node) => node.id === nodeId);
}

function outgoing(def: WorkflowDef, nodeId: string) {
  return def.edges.filter((edge) => edge.from === nodeId);
}

function record(state: RunState, event: RunEvent): void {
  state.log.push(event);
}

function spawn(state: RunState, nodeId: string, branchId: string, status: RunToken["status"] = "active", wakeAt?: number): RunToken {
  const token: RunToken = { id: id("tok", state.seq), nodeId, branchId, status, wakeAt };
  state.seq += 1;
  state.tokens.push(token);
  return token;
}

function openTask(state: RunState, node: WorkflowNode, branchId: string): HumanTask {
  const task: HumanTask = {
    id: id("task", state.seq),
    nodeId: node.id,
    branchId,
    role: node.role ?? "reviewer",
    status: "open",
  };
  state.seq += 1;
  state.tasks.push(task);
  return task;
}

export type JoinPolicy = "ALL" | "ANY" | "N_OF_M";

export function normalizeJoin(node: WorkflowNode, incoming: number): { policy: JoinPolicy; needed: number } {
  if (node.join === "any") return { policy: "ANY", needed: 1 };
  if (node.join === "n") return { policy: "N_OF_M", needed: Math.min(incoming, Math.max(1, node.joinCount ?? 1)) };
  return { policy: "ALL", needed: Math.max(1, incoming) };
}

/**
 * Record branch arrivals. Returns released=true only the first time the policy is met.
 * A second call after release does not continue the join again.
 */
export function arriveAtJoin(mark: JoinMark | undefined, branchIds: string[], needed: number): { mark: JoinMark; released: boolean } {
  const current: JoinMark = mark ? { arrived: [...mark.arrived], released: mark.released } : { arrived: [], released: false };
  if (current.released) return { mark: current, released: false };
  for (const branchId of branchIds) {
    if (!current.arrived.includes(branchId)) current.arrived.push(branchId);
  }
  if (current.arrived.length >= needed) {
    current.released = true;
    return { mark: current, released: true };
  }
  return { mark: current, released: false };
}

function follow(state: RunState, def: WorkflowDef, from: WorkflowNode, branchId: string, ctx: StepContext, decision?: string): void {
  const edges = outgoing(def, from.id);
  if (!edges.length) return;
  if (from.type === "decision" || from.type === "approval") {
    const matched = edges.find((edge) => edge.when === decision) ?? edges.find((edge) => evalBool(edge.when, { data: ctx.data, ...ctx.data }, false));
    const edge = matched ?? edges.find((edge) => !edge.when);
    if (edge) spawn(state, edge.to, branchId);
    return;
  }
  if (from.type === "parallel") {
    edges.forEach((edge, index) => spawn(state, edge.to, `${branchId}.${index}`));
    return;
  }
  for (const edge of edges) {
    if (edge.when && !evalBool(edge.when, { data: ctx.data, ...ctx.data }, false)) continue;
    spawn(state, edge.to, branchId);
  }
}

async function runService(node: WorkflowNode, ctx: StepContext): Promise<{ ok: boolean; output?: unknown; error?: string }> {
  const kind = node.service ?? (node.type === "http" ? "http" : node.type === "webhook" ? "webhook" : undefined);
  try {
    if (kind === "http" || kind === "webhook" || node.type === "http" || node.type === "webhook") {
      if (!node.url || !ctx.services.http) return { ok: false, error: "HTTP port is not configured" };
      const response = await ctx.services.http(node.url, ctx.data);
      return response.ok ? { ok: true, output: response.body ?? { status: response.status } } : { ok: false, error: `HTTP ${response.status}` };
    }
    if (kind === "pdf") {
      if (!ctx.services.pdf) return { ok: false, error: "PDF port is not configured" };
      return { ok: true, output: await ctx.services.pdf(ctx.data) };
    }
    if (kind === "archive") {
      if (!ctx.services.archive) return { ok: false, error: "Archive port is not configured" };
      return { ok: true, output: await ctx.services.archive(ctx.data) };
    }
    if (kind === "storage") {
      if (!ctx.services.storage) return { ok: false, error: "Storage port is not configured" };
      return { ok: true, output: await ctx.services.storage(ctx.data) };
    }
    if (kind === "ecm") {
      if (!ctx.services.ecm) return { ok: false, error: "ECM port is not configured" };
      return { ok: true, output: await ctx.services.ecm(node.ecmProfile, ctx.data) };
    }
    if (kind === "email") {
      if (!ctx.services.email) return { ok: false, error: "Email port is not configured" };
      const queued = await ctx.services.email(node.emailTemplate, ctx.data);
      return queued.queued ? { ok: true, output: queued } : { ok: false, error: "Email was not queued" };
    }
    if (kind === "ai") {
      if (!ctx.services.ai) return { ok: false, error: "AI port is not configured" };
      return { ok: true, output: await ctx.services.ai(node.aiInstruction, ctx.data) };
    }
    return { ok: false, error: `Unknown service ${kind ?? node.type}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Service failed" };
  }
}

function failOrRetry(state: RunState, token: RunToken, node: WorkflowNode, error: string, ctx: StepContext): void {
  const attempt = (state.attempts[node.id] ?? 0) + 1;
  state.attempts[node.id] = attempt;
  const limit = node.retryLimit ?? 6;
  token.status = "done";
  if (attempt >= limit || serviceBackoff(attempt - 1) < 0) {
    state.status = "DEAD_LETTER";
    record(state, { at: ctx.services.now(), actor: "system", action: "dead-letter", nodeId: node.id, detail: error });
    return;
  }
  state.status = "RETRYING";
  const delay = serviceBackoff(attempt - 1);
  spawn(state, node.id, token.branchId, "waiting", ctx.services.now() + delay);
  record(state, { at: ctx.services.now(), actor: "system", action: "retry", nodeId: node.id, detail: error });
}

async function advanceToken(state: RunState, def: WorkflowDef, token: RunToken, ctx: StepContext): Promise<void> {
  const node = nodeOf(def, token.nodeId);
  if (!node) {
    token.status = "done";
    state.status = "FAILED";
    record(state, { at: ctx.services.now(), actor: "system", action: "missing-node", nodeId: token.nodeId });
    return;
  }
  if (state.skipped.includes(node.id)) {
    token.status = "done";
    follow(state, def, node, token.branchId, ctx);
    record(state, { at: ctx.services.now(), actor: ctx.actor ?? "system", action: "skipped", nodeId: node.id });
    return;
  }
  if (node.type === "start" || node.type === "end") {
    token.status = "done";
    if (node.type === "end") {
      record(state, { at: ctx.services.now(), actor: "system", action: "reached-end", nodeId: node.id });
    } else {
      follow(state, def, node, token.branchId, ctx);
    }
    return;
  }
  if (node.type === "human" || node.type === "approval") {
    token.status = "waiting";
    openTask(state, node, token.branchId);
    state.status = "WAITING";
    record(state, { at: ctx.services.now(), actor: "system", action: "task-opened", nodeId: node.id });
    return;
  }
  if (node.type === "timer") {
    const due = ctx.services.now() + (node.delayMs ?? 0);
    if ((node.delayMs ?? 0) > 0 && ctx.services.now() < due && token.wakeAt == null) {
      token.status = "waiting";
      token.wakeAt = due;
      state.status = "WAITING";
      record(state, { at: ctx.services.now(), actor: "system", action: "timer-armed", nodeId: node.id, detail: String(due) });
      return;
    }
    token.status = "done";
    follow(state, def, node, token.branchId, ctx);
    record(state, { at: ctx.services.now(), actor: "system", action: "timer-fired", nodeId: node.id });
    return;
  }
  if (node.type === "join") {
    token.status = "done";
    const incoming = def.edges.filter((edge) => edge.to === node.id).length;
    const { needed } = normalizeJoin(node, incoming);
    const arrival = arriveAtJoin(state.joins[node.id], [token.branchId], needed);
    state.joins[node.id] = arrival.mark;
    if (arrival.released) {
      follow(state, def, node, "join", ctx);
      record(state, { at: ctx.services.now(), actor: "system", action: "join-released", nodeId: node.id, detail: arrival.mark.arrived.join(",") });
    } else {
      record(state, { at: ctx.services.now(), actor: "system", action: "join-waiting", nodeId: node.id, detail: `${arrival.mark.arrived.length}/${needed}` });
    }
    return;
  }
  if (node.type === "parallel" || node.type === "decision") {
    token.status = "done";
    follow(state, def, node, token.branchId, ctx);
    return;
  }
  const result = await runService(node, ctx);
  if (!result.ok) {
    failOrRetry(state, token, node, result.error ?? "failed", ctx);
    return;
  }
  token.status = "done";
  state.outputs[node.id] = result.output ?? null;
  follow(state, def, node, token.branchId, ctx);
  record(state, { at: ctx.services.now(), actor: "system", action: "service-ok", nodeId: node.id });
}

function deriveStatus(state: RunState): RunStatus {
  if (state.status === "CANCELLED" || state.status === "DEAD_LETTER" || state.status === "MANUAL_INTERVENTION" || state.status === "FAILED") return state.status;
  const active = state.tokens.some((token) => token.status === "active");
  const waiting = state.tokens.some((token) => token.status === "waiting") || state.tasks.some((task) => task.status === "open" || task.status === "claimed");
  const retrying = state.log[state.log.length - 1]?.action === "retry";
  if (active) return "RUNNING";
  if (retrying && waiting) return "RETRYING";
  if (waiting) return "WAITING";
  return "COMPLETED";
}

/** Advance every token that is allowed to run at services.now(). Safe to call after a restart. */
export async function step(state: RunState, def: WorkflowDef, ctx: StepContext, maxTicks = 30): Promise<RunState> {
  if (state.status === "CANCELLED" || state.status === "DEAD_LETTER" || state.status === "COMPLETED") return state;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const ready = state.tokens.filter((token) => token.status === "active" || (token.status === "waiting" && token.wakeAt != null && token.wakeAt <= ctx.services.now()));
    if (!ready.length) break;
    for (const token of ready) {
      if (token.status === "waiting" && token.wakeAt != null && token.wakeAt <= ctx.services.now()) token.status = "active";
      if (token.status !== "active") continue;
      await advanceToken(state, def, token, ctx);
      const after = state.status as RunStatus;
      if (after === "DEAD_LETTER" || after === "FAILED" || after === "CANCELLED") return state;
    }
  }
  state.status = deriveStatus(state);
  return state;
}

export function completeHumanTask(
  state: RunState,
  def: WorkflowDef,
  taskId: string,
  decision: "approve" | "reject" | "changes",
  actor: string,
  at: number,
): { ok: true } | { ok: false; code: "NOT_FOUND" | "ALREADY_DONE" } {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return { ok: false, code: "NOT_FOUND" };
  if (task.status === "done" || task.status === "cancelled") return { ok: false, code: "ALREADY_DONE" };
  task.status = "done";
  task.decision = decision;
  const token = state.tokens.find((item) => item.nodeId === task.nodeId && item.branchId === task.branchId && item.status === "waiting");
  if (token) token.status = "done";
  const node = nodeOf(def, task.nodeId);
  if (node) {
    const ctx: StepContext = { data: {}, services: { now: () => at }, actor };
    follow(state, def, node, task.branchId, ctx, decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "changes");
  }
  record(state, { at, actor, action: "task-completed", nodeId: task.nodeId, detail: decision });
  state.status = deriveStatus(state);
  return { ok: true };
}

export function reassignTask(state: RunState, taskId: string, assignee: string, actor: string, at: number): { ok: boolean; code?: string } {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return { ok: false, code: "NOT_FOUND" };
  if (task.status === "done") return { ok: false, code: "ALREADY_DONE" };
  task.assignee = assignee;
  task.status = "claimed";
  record(state, { at, actor, action: "reassign", nodeId: task.nodeId, detail: assignee });
  return { ok: true };
}

export function skipNode(state: RunState, nodeId: string, actor: string, reason: string, at: number): RunState {
  if (!reason.trim()) return state;
  state.skipped.push(nodeId);
  record(state, { at, actor, action: "skip", nodeId, detail: reason });
  return state;
}

export function cancelRun(state: RunState, actor: string, at: number): RunState {
  state.status = "CANCELLED";
  for (const token of state.tokens) if (token.status !== "done") token.status = "done";
  for (const task of state.tasks) if (task.status === "open" || task.status === "claimed") task.status = "cancelled";
  record(state, { at, actor, action: "cancel" });
  return state;
}

export function resumeRun(state: RunState, actor: string, at: number): RunState {
  if (state.status !== "MANUAL_INTERVENTION" && state.status !== "FAILED") return state;
  state.status = "RUNNING";
  record(state, { at, actor, action: "resume" });
  return state;
}

export function markManual(state: RunState, actor: string, reason: string, at: number): RunState {
  state.status = "MANUAL_INTERVENTION";
  record(state, { at, actor, action: "manual", detail: reason });
  return state;
}

export function retryNode(state: RunState, def: WorkflowDef, nodeId: string, actor: string, at: number): RunState {
  if (!nodeOf(def, nodeId)) return state;
  state.attempts[nodeId] = 0;
  if (state.status === "DEAD_LETTER" || state.status === "FAILED") state.status = "RUNNING";
  spawn(state, nodeId, "retry");
  record(state, { at, actor, action: "operator-retry", nodeId });
  return state;
}

/** Serialize for a worker handoff. */
export function snapshotRun(state: RunState): string {
  return JSON.stringify(state);
}

export function restoreRun(raw: string): RunState {
  const parsed = JSON.parse(raw) as RunState;
  if (!parsed || !Array.isArray(parsed.tokens) || !Array.isArray(parsed.log)) throw new Error("Run snapshot is not valid");
  return parsed;
}
