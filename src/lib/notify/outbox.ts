import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { assertNoRawSecret, renderNotice, type NoticeName } from "./provider.ts";

export interface OutboxRow {
  id: string;
  tenantId: string;
  templateName: NoticeName;
  to: string;
  status: "queued" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  subject: string;
}

export async function enqueueOutbox(
  db: Queryable,
  input: { tenantId: string; template: NoticeName; to: string; vars: Record<string, string>; secretRef?: string },
): Promise<OutboxRow> {
  if (input.secretRef) assertNoRawSecret({ secretRef: input.secretRef });
  if (!input.to.includes("@")) throw new Error("Recipient is required");
  const rendered = renderNotice(input.template, input.vars);
  const id = `ntf_${randomBytes(6).toString("hex")}`;
  const payload = { subject: rendered.subject, text: rendered.text, html: rendered.html, secretRef: input.secretRef ?? null };
  await db.query(
    `insert into notification_outbox (id, tenant_id, template_name, to_address, payload, status, attempts)
     values ($1,$2,$3,$4,$5::jsonb,'queued',0)`,
    [id, input.tenantId, input.template, input.to, JSON.stringify(payload)],
  );
  return { id, tenantId: input.tenantId, templateName: input.template, to: input.to, status: "queued", attempts: 0, lastError: null, subject: rendered.subject };
}

export async function deliverOutbox(
  db: Queryable,
  send: (row: { to: string; subject: string; html: string }) => Promise<void>,
  limit = 20,
): Promise<{ sent: number; failed: number }> {
  const rows = await db.query<{ id: string; to_address: string; payload: { subject?: string; html?: string }; attempts: number }>(
    "select id, to_address, payload, attempts from notification_outbox where status = 'queued' order by created_at limit $1",
    [limit],
  );
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const subject = String(row.payload?.subject ?? "");
    const html = String(row.payload?.html ?? "");
    try {
      await send({ to: row.to_address, subject, html });
      await db.query("update notification_outbox set status = 'sent', attempts = attempts + 1 where id = $1", [row.id]);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "send failed";
      await db.query("update notification_outbox set status = 'failed', attempts = attempts + 1, last_error = $2 where id = $1", [row.id, message]);
      failed += 1;
    }
  }
  return { sent, failed };
}
