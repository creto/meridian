import type { WorkflowDef, WorkflowEdge, WorkflowNode } from "../forms/types.ts";

export interface EditorState {
  present: WorkflowDef;
  past: WorkflowDef[];
  future: WorkflowDef[];
}

export type EditorResult = { ok: true; state: EditorState } | { ok: false; reason: string };

export interface EditorIssue {
  code: "missing-start" | "missing-end" | "unknown-edge" | "unreachable" | "join-unfed" | "missing-url";
  message: string;
  nodeId?: string;
}

const HISTORY_CAP = 50;

function cloneDef(def: WorkflowDef): WorkflowDef {
  return structuredClone(def);
}

function commit(state: EditorState, next: WorkflowDef): EditorResult {
  const past = [...state.past, cloneDef(state.present)].slice(-HISTORY_CAP);
  return { ok: true, state: { present: cloneDef(next), past, future: [] } };
}

export function createEmptyWorkflow(): WorkflowDef {
  return {
    nodes: [
      { id: "start", type: "start", title: "Start" },
      { id: "end", type: "end", title: "End" },
    ],
    edges: [{ from: "start", to: "end" }],
  };
}

export function createEditorState(def?: WorkflowDef): EditorState {
  return { present: cloneDef(def ?? createEmptyWorkflow()), past: [], future: [] };
}

export function addNode(state: EditorState, node: WorkflowNode): EditorResult {
  if (!node.id?.trim() || !node.type) return { ok: false, reason: "node id and type are required" };
  if (state.present.nodes.some((existing) => existing.id === node.id)) {
    return { ok: false, reason: "duplicate node id" };
  }
  return commit(state, {
    nodes: [...state.present.nodes, node],
    edges: state.present.edges,
  });
}

export function updateNode(state: EditorState, nodeId: string, patch: Partial<WorkflowNode>): EditorResult {
  const current = state.present.nodes.find((node) => node.id === nodeId);
  if (!current) return { ok: false, reason: "unknown node" };
  if (patch.id !== undefined && patch.id !== nodeId) return { ok: false, reason: "cannot change node id" };
  const nodes = state.present.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch, id: nodeId } : node));
  return commit(state, { nodes, edges: state.present.edges });
}

export function removeNode(state: EditorState, nodeId: string): EditorResult {
  const node = state.present.nodes.find((item) => item.id === nodeId);
  if (!node) return { ok: false, reason: "unknown node" };
  if (node.type === "start" && state.present.nodes.filter((item) => item.type === "start").length <= 1) {
    return { ok: false, reason: "cannot remove the last start" };
  }
  if (node.type === "end" && state.present.nodes.filter((item) => item.type === "end").length <= 1) {
    return { ok: false, reason: "cannot remove the last end" };
  }
  return commit(state, {
    nodes: state.present.nodes.filter((item) => item.id !== nodeId),
    edges: state.present.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
  });
}

export function connect(state: EditorState, edge: WorkflowEdge): EditorResult {
  const ids = new Set(state.present.nodes.map((node) => node.id));
  if (!ids.has(edge.from) || !ids.has(edge.to)) {
    const missing = [edge.from, edge.to].filter((id, index, all) => !ids.has(id) && all.indexOf(id) === index);
    return { ok: false, reason: `unknown node: ${missing.join(", ")}` };
  }
  if (edge.from === edge.to) return { ok: false, reason: "self-loop" };
  if (state.present.edges.some((existing) => existing.from === edge.from && existing.to === edge.to)) {
    return { ok: false, reason: "duplicate edge" };
  }
  const stored: WorkflowEdge = { from: edge.from, to: edge.to };
  if (edge.when) stored.when = edge.when;
  return commit(state, { nodes: state.present.nodes, edges: [...state.present.edges, stored] });
}

export function disconnect(state: EditorState, from: string, to: string): EditorResult {
  const edges = state.present.edges.filter((edge) => !(edge.from === from && edge.to === to));
  if (edges.length === state.present.edges.length) return { ok: false, reason: "edge not found" };
  return commit(state, { nodes: state.present.nodes, edges });
}

export function setJoin(state: EditorState, nodeId: string, join: "all" | "any" | "n", joinCount?: number): EditorResult {
  const node = state.present.nodes.find((item) => item.id === nodeId);
  if (!node) return { ok: false, reason: "unknown node" };
  if (join !== "all" && join !== "any" && join !== "n") return { ok: false, reason: "invalid join" };
  if (join === "n" && (!Number.isInteger(joinCount) || (joinCount ?? 0) < 1)) {
    return { ok: false, reason: "joinCount required" };
  }
  const nodes = state.present.nodes.map((current) => {
    if (current.id !== nodeId) return current;
    const next: WorkflowNode = { ...current, join };
    if (join === "n") next.joinCount = joinCount;
    else delete next.joinCount;
    return next;
  });
  return commit(state, { nodes, edges: state.present.edges });
}

export function undo(state: EditorState): EditorResult {
  if (state.past.length === 0) return { ok: false, reason: "nothing to undo" };
  const previous = state.past[state.past.length - 1]!;
  return {
    ok: true,
    state: {
      present: cloneDef(previous),
      past: state.past.slice(0, -1),
      future: [cloneDef(state.present), ...state.future],
    },
  };
}

export function redo(state: EditorState): EditorResult {
  if (state.future.length === 0) return { ok: false, reason: "nothing to redo" };
  const next = state.future[0]!;
  return {
    ok: true,
    state: {
      present: cloneDef(next),
      past: [...state.past, cloneDef(state.present)].slice(-HISTORY_CAP),
      future: state.future.slice(1),
    },
  };
}

function needsUrl(node: WorkflowNode): boolean {
  if (node.type === "http" || node.type === "webhook") return true;
  return node.type === "service" && (node.service === "http" || node.service === "webhook");
}

function urlMissing(node: WorkflowNode): boolean {
  return typeof node.url !== "string" || node.url.trim() === "";
}

function reachableIds(def: WorkflowDef): Set<string> {
  const known = new Set(def.nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  for (const edge of def.edges) {
    const list = outgoing.get(edge.from);
    if (list) list.push(edge.to);
    else outgoing.set(edge.from, [edge.to]);
  }
  const seen = new Set<string>();
  const queue = def.nodes.filter((node) => node.type === "start").map((node) => node.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id) || !known.has(id)) continue;
    seen.add(id);
    for (const next of outgoing.get(id) ?? []) queue.push(next);
  }
  return seen;
}

export function validateEditor(def: WorkflowDef): EditorIssue[] {
  const issues: EditorIssue[] = [];
  const ids = new Set(def.nodes.map((node) => node.id));
  if (!def.nodes.some((node) => node.type === "start")) {
    issues.push({ code: "missing-start", message: "Missing start node" });
  }
  if (!def.nodes.some((node) => node.type === "end")) {
    issues.push({ code: "missing-end", message: "Missing end node" });
  }
  for (const edge of def.edges) {
    if (!ids.has(edge.from)) {
      issues.push({
        code: "unknown-edge",
        message: `Edge from ${edge.from} to ${edge.to} leaves an unknown node`,
        nodeId: edge.from,
      });
    }
    if (!ids.has(edge.to)) {
      issues.push({
        code: "unknown-edge",
        message: `Edge from ${edge.from} to ${edge.to} points at an unknown node`,
        nodeId: edge.to,
      });
    }
  }
  if (def.nodes.some((node) => node.type === "start")) {
    const reachable = reachableIds(def);
    for (const node of def.nodes) {
      if (!reachable.has(node.id)) {
        issues.push({ code: "unreachable", message: `Node ${node.id} is unreachable from start`, nodeId: node.id });
      }
    }
  }
  const incoming = new Set(def.edges.map((edge) => edge.to));
  for (const node of def.nodes) {
    if (node.type === "join" && !incoming.has(node.id)) {
      issues.push({ code: "join-unfed", message: `Join node ${node.id} has zero incoming edges`, nodeId: node.id });
    }
    if (needsUrl(node) && urlMissing(node)) {
      issues.push({
        code: "missing-url",
        message: `Node ${node.id} is an http/webhook service with an empty url`,
        nodeId: node.id,
      });
    }
  }
  return issues;
}
