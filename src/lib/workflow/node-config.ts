import type { WorkflowDef, WorkflowNode } from "../forms/types.ts";

export interface NodeIssue {
  nodeId: string;
  code: string;
  message: string;
}

function urlOk(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function inspectNode(node: WorkflowNode, incoming: number): NodeIssue[] {
  const issues: NodeIssue[] = [];
  if ((node.type === "http" || node.type === "webhook" || node.service === "http" || node.service === "webhook") && !urlOk(node.url)) {
    issues.push({ nodeId: node.id, code: "url", message: `${node.title} needs an http(s) URL` });
  }
  if (node.type === "timer" && (node.delayMs == null || node.delayMs < 0)) {
    issues.push({ nodeId: node.id, code: "timer", message: `${node.title} needs a non-negative delay` });
  }
  if (node.type === "approval" && !node.role) {
    issues.push({ nodeId: node.id, code: "role", message: `${node.title} needs a role` });
  }
  if (node.type === "join") {
    const policy = node.join ?? "all";
    if (policy === "n" && (!node.joinCount || node.joinCount < 1 || node.joinCount > incoming)) {
      issues.push({ nodeId: node.id, code: "join", message: `${node.title} N-of-M count must be between 1 and ${incoming}` });
    }
  }
  if (node.service === "email" && !node.emailTemplate) {
    issues.push({ nodeId: node.id, code: "email", message: `${node.title} needs an email template` });
  }
  if (node.service === "ai" && !node.aiInstruction) {
    issues.push({ nodeId: node.id, code: "ai", message: `${node.title} needs an instruction` });
  }
  if (node.service === "ecm" && !node.ecmProfile) {
    issues.push({ nodeId: node.id, code: "ecm", message: `${node.title} needs an ECM profile` });
  }
  if (node.retryLimit != null && (node.retryLimit < 0 || node.retryLimit > 20)) {
    issues.push({ nodeId: node.id, code: "retry", message: `${node.title} retry limit must be 0 to 20` });
  }
  return issues;
}

export function inspectWorkflow(def: WorkflowDef): NodeIssue[] {
  const incoming = new Map<string, number>();
  for (const edge of def.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  return def.nodes.flatMap((node) => inspectNode(node, incoming.get(node.id) ?? 0));
}
