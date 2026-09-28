import type { WorkflowDef, WorkflowNode } from "../forms/types.ts";
import { blockedDestination } from "../security/ssrf.ts";

export interface GraphIssue {
  code: string;
  message: string;
  nodeId?: string;
}

const SERVICE_NODES = new Set(["service", "http", "webhook"]);

function outgoing(def: WorkflowDef, id: string) {
  return def.edges.filter((edge) => edge.from === id);
}

function incoming(def: WorkflowDef, id: string) {
  return def.edges.filter((edge) => edge.to === id);
}

function reachable(def: WorkflowDef, startId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const edge of outgoing(def, id)) stack.push(edge.to);
  }
  return seen;
}

function checkNode(def: WorkflowDef, node: WorkflowNode, issues: GraphIssue[]) {
  if (node.type === "join") {
    if (incoming(def, node.id).length === 0) issues.push({ code: "JOIN_ORPHAN", message: `Join ${node.title} has no incoming branch`, nodeId: node.id });
    const policy = node.join ?? "all";
    if (!["all", "any", "n"].includes(policy)) issues.push({ code: "JOIN_POLICY", message: `Join ${node.title} has an unknown policy`, nodeId: node.id });
    if (policy === "n" && (!node.joinCount || node.joinCount < 1)) {
      issues.push({ code: "JOIN_COUNT", message: `Join ${node.title} needs joinCount for an n-of-m gate`, nodeId: node.id });
    }
  }
  if (node.type === "parallel" && outgoing(def, node.id).length < 2) {
    issues.push({ code: "PARALLEL_WIDTH", message: `Parallel ${node.title} needs at least two outgoing branches`, nodeId: node.id });
  }
  if (node.type === "timer" && (node.delayMs == null || node.delayMs < 0)) {
    issues.push({ code: "TIMER", message: `Timer ${node.title} needs a non-negative delayMs`, nodeId: node.id });
  }
  if (node.type === "human" || node.type === "approval") {
    if (!node.role?.trim()) issues.push({ code: "ASSIGNMENT", message: `${node.title} has no assigned role`, nodeId: node.id });
  }
  if (SERVICE_NODES.has(node.type) && node.type !== "service" && !node.url?.trim() && node.service !== "pdf" && node.service !== "archive" && node.service !== "storage") {
    issues.push({ code: "SERVICE_URL", message: `${node.title} is missing a URL`, nodeId: node.id });
  }
  if (node.url) {
    const blocked = blockedDestination(node.url);
    if (blocked) issues.push({ code: "SSRF", message: `${node.title}: ${blocked}`, nodeId: node.id });
  }
  if (node.type === "decision") {
    const edges = outgoing(def, node.id);
    if (edges.length < 2) issues.push({ code: "DECISION", message: `Decision ${node.title} needs at least two outcomes`, nodeId: node.id });
    if (edges.some((edge) => !edge.when?.trim())) issues.push({ code: "DECISION_WHEN", message: `Decision ${node.title} has an edge without a condition`, nodeId: node.id });
  }
}

/** Structural validation. Does not execute the workflow. */
export function validateWorkflow(def: WorkflowDef | undefined): GraphIssue[] {
  if (!def) return [{ code: "MISSING", message: "Workflow is missing" }];
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  for (const node of def.nodes) {
    if (ids.has(node.id)) issues.push({ code: "DUP_NODE", message: `Duplicate node ${node.id}`, nodeId: node.id });
    ids.add(node.id);
  }
  const starts = def.nodes.filter((node) => node.type === "start");
  const ends = def.nodes.filter((node) => node.type === "end");
  if (starts.length !== 1) issues.push({ code: "START", message: `Workflow needs exactly one start (found ${starts.length})` });
  if (ends.length < 1) issues.push({ code: "END", message: "Workflow needs an end node" });
  for (const edge of def.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      issues.push({ code: "DANGLING_EDGE", message: `Edge ${edge.from} -> ${edge.to} references a missing node` });
    }
    if (edge.to && def.nodes.find((node) => node.id === edge.to)?.type === "start") {
      issues.push({ code: "EDGE_TO_START", message: "An edge points at the start node", nodeId: edge.to });
    }
  }
  const start = starts[0];
  if (start) {
    const seen = reachable(def, start.id);
    for (const node of def.nodes) {
      if (!seen.has(node.id)) issues.push({ code: "UNREACHABLE", message: `${node.title} is not reachable from start`, nodeId: node.id });
    }
    if (ends.length && !ends.some((node) => seen.has(node.id))) {
      issues.push({ code: "END_UNREACHABLE", message: "No end node is reachable from start" });
    }
  }
  for (const node of def.nodes) checkNode(def, node, issues);
  return issues;
}

export function traceWorkflow(def: WorkflowDef, outcome: "approved" | "rejected"): string[] {
  const start = def.nodes.find((node) => node.type === "start");
  if (!start) return [];
  const path = [start.id];
  const seen = new Set<string>([start.id]);
  let current = start.id;
  while (path.length < 24) {
    const edges = def.edges.filter((edge) => edge.from === current);
    const next = edges.find((edge) => !edge.when || edge.when === outcome) ?? edges[0];
    if (!next || seen.has(next.to)) break;
    seen.add(next.to);
    path.push(next.to);
    const node = def.nodes.find((item) => item.id === next.to);
    if (!node || node.type === "end") break;
    current = next.to;
  }
  return path;
}

export function workflowOk(def: WorkflowDef | undefined): boolean {
  return validateWorkflow(def).length === 0;
}
