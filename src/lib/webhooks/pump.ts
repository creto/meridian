import type { Queryable } from "../platform/durable.ts";
import { recordSignedAttempt, webhookHeaders } from "../platform/webhook-sign.ts";
import { blockedDestination } from "../security/ssrf.ts";

interface DueDelivery {
  id: string;
  tenant_id: string;
  endpoint_id: string;
  event: string;
  payload: unknown;
  url: string;
  secret_name: string;
  enabled: boolean;
}

export interface PumpOptions {
  resolveSecret: (tenantId: string, name: string) => Promise<string | null>;
  fetchImpl?: typeof fetch;
  limit?: number;
}

export async function deliverDueWebhooks(db: Queryable, options: PumpOptions): Promise<{ delivered: number; failed: number; blocked: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const rows = await db.query<DueDelivery>(
    `select d.id, d.tenant_id, d.endpoint_id, d.event, d.payload, e.url, e.secret_name, e.enabled
     from webhook_deliveries d
     join webhook_endpoints e on e.id = d.endpoint_id and e.tenant_id = d.tenant_id
     where d.status in ('queued', 'retry') and (d.next_attempt_at is null or d.next_attempt_at <= now())
     order by d.created_at
     limit $1`,
    [limit],
  );
  let delivered = 0;
  let failed = 0;
  let blocked = 0;
  const fetchImpl = options.fetchImpl ?? fetch;
  for (const row of rows) {
    const body = JSON.stringify(typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload);
    if (!row.enabled) {
      await recordSignedAttempt(db, { tenantId: row.tenant_id, deliveryId: row.id, ok: false, error: "Endpoint is disabled" });
      failed += 1;
      continue;
    }
    const reason = blockedDestination(row.url);
    if (reason) {
      await recordSignedAttempt(db, { tenantId: row.tenant_id, deliveryId: row.id, ok: false, error: reason });
      blocked += 1;
      continue;
    }
    const secret = await options.resolveSecret(row.tenant_id, row.secret_name);
    if (!secret) {
      await recordSignedAttempt(db, { tenantId: row.tenant_id, deliveryId: row.id, ok: false, error: "Signing secret is missing" });
      failed += 1;
      continue;
    }
    try {
      const response = await fetchImpl(row.url, { method: "POST", headers: webhookHeaders(secret, body), body });
      const outcome = await recordSignedAttempt(db, {
        tenantId: row.tenant_id,
        deliveryId: row.id,
        ok: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      });
      if (outcome === "delivered") delivered += 1;
      else failed += 1;
    } catch (error) {
      await recordSignedAttempt(db, {
        tenantId: row.tenant_id,
        deliveryId: row.id,
        ok: false,
        error: error instanceof Error ? error.message : "Delivery failed",
      });
      failed += 1;
    }
  }
  return { delivered, failed, blocked };
}
