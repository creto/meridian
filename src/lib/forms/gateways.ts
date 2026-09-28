import { uid } from "./ids.ts";
import type { FormDefinition, WorkflowState } from "./types.ts";

function edgeTo(form: FormDefinition, from: string, when: string): string | null {
  return form.workflow?.edges.find((edge) => edge.from === from && (edge.when ?? "approved") === when)?.to ?? null;
}

export interface GatewayToken {
  id: string;
  branchId: string;
  nodeId: string;
  status: "active" | "arrived" | "done" | "cancelled";
}

function isJoin(form: FormDefinition, nodeId: string): boolean {
  return form.workflow?.nodes.some((node) => node.id === nodeId && node.type === "join") ?? false;
}

export function splitParallel(form: FormDefinition, nodeId: string): GatewayToken[] {
  const edges = form.workflow?.edges.filter((edge) => edge.from === nodeId) ?? [];
  return edges.map((edge) => ({
    id: uid("tok"),
    branchId: edge.to,
    nodeId: edge.to,
    status: isJoin(form, edge.to) ? "arrived" : "active",
  }));
}

export function joinReady(form: FormDefinition, tokens: GatewayToken[]): { ready: boolean; joinId?: string; next?: string } {
  for (const join of form.workflow?.nodes.filter((node) => node.type === "join") ?? []) {
    const incoming = form.workflow?.edges.filter((edge) => edge.to === join.id) ?? [];
    const arrived = tokens.filter((token) => token.nodeId === join.id && (token.status === "arrived" || token.status === "done"));
    const need = join.join === "any" ? 1 : join.join === "n" ? Math.max(1, join.joinCount ?? incoming.length) : incoming.length;
    if (incoming.length > 0 && arrived.length >= need) {
      return { ready: true, joinId: join.id, next: edgeTo(form, join.id, "approved") ?? undefined };
    }
  }
  return { ready: false };
}

export function scheduleTimer(delayMs: number, now = Date.now()): { fireNow: boolean; waitUntil?: string } {
  if (delayMs <= 0) return { fireNow: true };
  return { fireNow: false, waitUntil: new Date(now + delayMs).toISOString() };
}

export function timerDue(waitUntil: string | undefined, now = Date.now()): boolean {
  if (!waitUntil) return false;
  return Date.parse(waitUntil) <= now;
}

/** Move one active branch. With no tokens, this is the single-path approve/reject used by supplier review. */
export function applyHumanAction(
  form: FormDefinition,
  state: WorkflowState,
  action: "approve" | "reject",
  actor: string,
  note: string,
  now: string,
): WorkflowState {
  const when = action === "approve" ? "approved" : "rejected";
  const tokens = (state.tokens ?? []) as GatewayToken[];
  if (tokens.length === 0) {
    const target = edgeTo(form, state.currentNode, when);
    return {
      currentNode: target ?? state.currentNode,
      history: [...state.history, { node: state.currentNode, at: now, action: when, actor, note }],
    };
  }
  const index = tokens.findIndex((token) => token.status === "active" && token.nodeId === state.currentNode);
  const idx = index >= 0 ? index : tokens.findIndex((token) => token.status === "active");
  const history = [...state.history, { node: tokens[idx]?.nodeId ?? state.currentNode, at: now, action: when, actor, note }];
  if (idx < 0) return { ...state, history };
  const token = tokens[idx]!;
  const target = edgeTo(form, token.nodeId, when);
  const nextTokens = tokens.slice();
  if (!target) nextTokens[idx] = { ...token, status: "done" };
  else if (isJoin(form, target)) nextTokens[idx] = { ...token, nodeId: target, status: "arrived" };
  else nextTokens[idx] = { ...token, nodeId: target, status: "active" };
  const gate = joinReady(form, nextTokens);
  if (gate.ready && gate.next) {
    history.push({ node: gate.joinId ?? token.nodeId, at: now, action: "joined", actor, note: "all" });
    return {
      currentNode: gate.next,
      tokens: nextTokens.map((item) => (item.nodeId === gate.joinId ? { ...item, status: "done" } : item)),
      history,
    };
  }
  const nextActive = nextTokens.find((item) => item.status === "active");
  return { currentNode: nextActive?.nodeId ?? state.currentNode, tokens: nextTokens, history, waitUntil: state.waitUntil };
}
