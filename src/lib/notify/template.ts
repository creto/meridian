import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";

const AMP = String.fromCharCode(38);
const ESCAPE: Record<string, string> = {
  [AMP]: `${AMP}amp;`,
  "<": `${AMP}lt;`,
  ">": `${AMP}gt;`,
  '"': `${AMP}quot;`,
  "'": `${AMP}#39;`,
};

export function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE[char] ?? char);
}

/** `{{name}}` is escaped. Missing names become an empty string. Raw HTML is not supported. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => escapeText(vars[key] ?? ""));
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}

/** Records the message as a job. It does not claim the mail was delivered. */
export function createQueuedMail(db: Queryable, tenantId: string): MailProvider {
  return {
    async send(message) {
      if (!message.to.includes("@")) return { ok: false, error: "Recipient is not an email address" };
      const id = `job_${randomBytes(8).toString("hex")}`;
      await db.query(
        `insert into jobs (id, tenant_id, queue, status, payload) values ($1,$2,'email','queued',$3::jsonb)`,
        [id, tenantId, JSON.stringify({ to: message.to, subject: message.subject, text: message.text })],
      );
      return { ok: true, id };
    },
  };
}

export function assignmentMessage(input: { form: string; task: string; link: string }): MailMessage {
  return {
    to: "",
    subject: renderTemplate("Review {{form}}", { form: input.form }),
    text: renderTemplate("A task is waiting on {{form}}.\n{{link}}", input),
  };
}
