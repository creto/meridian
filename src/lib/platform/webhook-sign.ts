import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Queryable } from "./durable.ts";

export const WEBHOOK_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000];

export function signWebhook(secret: string, body: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhook(secret: string, body: string, timestamp: number, signature: string, now = Date.now()): boolean {
  if (Math.abs(now - timestamp) > 5 * 60_000) return false;
  const expected = signWebhook(secret, body, timestamp);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function webhookHeaders(secret: string, body: string, now = Date.now()): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-meridian-timestamp": String(now),
    "x-meridian-signature": signWebhook(secret, body, now),
  };
}

export async function enqueueSignedDelivery(
  db: Queryable,
  input: { tenantId: string; endpointId: string; event: string; payload: unknown },
): Promise<string> {
  const id = `whd_${randomBytes(8).toString("hex")}`;
  await db.query(
    `insert into webhook_deliveries (id, tenant_id, endpoint_id, event, payload, status, next_attempt_at)
     values ($1,$2,$3,$4,$5::jsonb,'queued', now())`,
    [id, input.tenantId, input.endpointId, input.event, JSON.stringify(input.payload)],
  );
  await db.query(
    `insert into outbox_events (id, tenant_id, topic, payload) values ($1,$2,'webhook.queued',$3::jsonb)`,
    [`out_${id}`, input.tenantId, JSON.stringify({ deliveryId: id, event: input.event })],
  );
  return id;
}

export async function recordSignedAttempt(
  db: Queryable,
  input: { tenantId: string; deliveryId: string; ok: boolean; statusCode?: number; error?: string },
): Promise<"delivered" | "retry" | "dead"> {
  const rows = await db.query<{ attempts: number; tenant_id: string }>(
    "select attempts, tenant_id from webhook_deliveries where id = $1 and tenant_id = $2",
    [input.deliveryId, input.tenantId],
  );
  const row = rows[0];
  if (!row) return "dead";
  const attempt = Number(row.attempts) + 1;
  await db.query(
    `insert into webhook_attempts (id, tenant_id, delivery_id, attempt, status_code, error)
     values ($1,$2,$3,$4,$5,$6)`,
    [`wha_${input.deliveryId}_${attempt}`, input.tenantId, input.deliveryId, attempt, input.statusCode ?? null, input.error ?? null],
  );
  if (input.ok) {
    await db.query("update webhook_deliveries set status = 'delivered', attempts = $2, last_error = null where id = $1 and tenant_id = $3", [
      input.deliveryId,
      attempt,
      input.tenantId,
    ]);
    return "delivered";
  }
  const delay = WEBHOOK_BACKOFF_MS[attempt - 1];
  if (delay == null) {
    await db.query("update webhook_deliveries set status = 'dead', attempts = $2, last_error = $3 where id = $1 and tenant_id = $4", [
      input.deliveryId,
      attempt,
      input.error ?? "failed",
      input.tenantId,
    ]);
    await db.query(
      `insert into dead_letter_events (id, tenant_id, source, payload, reason) values ($1,$2,'webhook',$3::jsonb,$4)`,
      [`dead_${input.deliveryId}`, input.tenantId, JSON.stringify({ deliveryId: input.deliveryId }), input.error ?? "exhausted"],
    );
    return "dead";
  }
  await db.query(
    `update webhook_deliveries set status = 'retry', attempts = $2, last_error = $3, next_attempt_at = now() + ($4 || ' milliseconds')::interval
     where id = $1 and tenant_id = $5`,
    [input.deliveryId, attempt, input.error ?? "failed", String(delay), input.tenantId],
  );
  return "retry";
}
