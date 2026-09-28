import { evalBool } from "../forms/expressions.ts";

export interface AbacSubject {
  submission: Record<string, unknown>;
  actor: Record<string, unknown>;
  workspace: Record<string, unknown>;
}

export interface AbacPolicy {
  id: string;
  action: string;
  expression: string;
  enabled: boolean;
}

export function evaluatePolicy(expression: string, subject: AbacSubject): boolean {
  if (!expression.trim()) return true;
  return evalBool(expression, {
    submission: subject.submission,
    actor: subject.actor,
    workspace: subject.workspace,
    data: subject.submission,
  }, false);
}

export function decide(action: string, policies: AbacPolicy[], subject: AbacSubject): { allow: boolean; failed: string[] } {
  const relevant = policies.filter((policy) => policy.enabled && policy.action === action);
  const failed = relevant.filter((policy) => !evaluatePolicy(policy.expression, subject)).map((policy) => policy.id);
  return { allow: failed.length === 0, failed };
}

export function assertAllowed(action: string, policies: AbacPolicy[], subject: AbacSubject): void {
  const result = decide(action, policies, subject);
  if (!result.allow) throw new Error(`ABAC denied ${action}: ${result.failed.join(",")}`);
}
