import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

export type NoticeName =
  | "submission_confirmation"
  | "task_assignment"
  | "approval"
  | "rejection"
  | "request_changes"
  | "resume_link"
  | "workflow_failure";

export interface NoticeMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  secretRef?: string;
}

export interface NotificationProvider {
  readonly id: string;
  send(message: NoticeMessage): Promise<{ id: string }>;
}

const TEMPLATES: Record<NoticeName, { subject: string; body: string }> = {
  submission_confirmation: { subject: "We received {{title}}", body: "Hello {{name}}, your submission {{id}} is filed." },
  task_assignment: { subject: "Task: {{title}}", body: "{{name}} assigned you {{title}}. Open {{url}}." },
  approval: { subject: "{{title}} was approved", body: "{{name}} approved {{id}}." },
  rejection: { subject: "{{title}} was rejected", body: "{{name}} rejected {{id}}. {{reason}}" },
  request_changes: { subject: "Changes requested on {{title}}", body: "{{name}} asked for changes: {{reason}}" },
  resume_link: { subject: "Resume {{title}}", body: "Continue at {{url}}." },
  workflow_failure: { subject: "Workflow needs attention", body: "{{title}} stopped: {{reason}}" },
};

function escapeHtml(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .replace(/&/g, `${amp}amp;`)
    .replace(/</g, `${amp}lt;`)
    .replace(/>/g, `${amp}gt;`)
    .replace(/"/g, `${amp}quot;`)
    .replace(/'/g, `${amp}#39;`);
}

export function renderNotice(name: NoticeName, vars: Record<string, string>): { subject: string; text: string; html: string } {
  const template = TEMPLATES[name];
  const fill = (source: string, escape: boolean) => source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key] ?? "";
    return escape ? escapeHtml(value) : value;
  });
  const text = fill(template.body, false);
  return { subject: fill(template.subject, false), text, html: `<p>${fill(template.body, true)}</p>` };
}

export function buildSmtpMessage(message: NoticeMessage, from: string): string {
  return [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    message.text,
  ].join("\r\n");
}

export function buildHttpApiMessage(message: NoticeMessage): { to: string; subject: string; html: string; secretRef?: string } {
  return { to: message.to, subject: message.subject, html: message.html, secretRef: message.secretRef };
}

export function assertNoRawSecret(config: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && /secret|password|apiKey/i.test(key) && value.length > 0 && !value.startsWith("secret:")) {
      throw new Error(`${key} must be a secret reference`);
    }
  }
}

export function createMemoryProvider(): NotificationProvider & { sent: NoticeMessage[] } {
  const sent: NoticeMessage[] = [];
  return {
    id: "memory",
    sent,
    async send(message) {
      sent.push(message);
      return { id: `ntf_${randomBytes(4).toString("hex")}` };
    },
  };
}

export async function enqueueNotice(db: Queryable, tenantId: string, templateName: NoticeName, to: string, vars: Record<string, string>): Promise<string> {
  const id = `ntf_${randomBytes(6).toString("hex")}`;
  const rendered = renderNotice(templateName, vars);
  await db.query(
    `insert into notification_outbox (id, tenant_id, template_name, to_address, payload, status) values ($1,$2,$3,$4,$5::jsonb,'queued')`,
    [id, tenantId, templateName, to, JSON.stringify({ ...rendered, vars })],
  );
  return id;
}
