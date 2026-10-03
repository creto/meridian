import assert from "node:assert/strict";
import test from "node:test";
import type { Queryable } from "../platform/durable.ts";
import { deliverDueWebhooks } from "./pump.ts";

function memoryDb(url: string): { db: Queryable; errors: string[] } {
  const errors: string[] = [];
  const db: Queryable = {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      if (text.includes("from webhook_deliveries d")) {
        return [
          {
            id: "d1",
            tenant_id: "t1",
            endpoint_id: "e1",
            event: "form.submitted",
            payload: { ok: true },
            url,
            secret_name: "whsec",
            enabled: true,
          },
        ] as T[];
      }
      if (text.startsWith("select attempts")) return [{ attempts: 0, tenant_id: "t1" }] as T[];
      if (text.includes("insert into webhook_attempts")) {
        errors.push(String(params[5] ?? ""));
        return [] as T[];
      }
      return [] as T[];
    },
  };
  return { db, errors };
}

test("webhook pump does not follow a 302 to loopback or metadata", async () => {
  const hops = ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data"];
  for (const evil of hops) {
    const seen: string[] = [];
    const { db, errors } = memoryDb("https://example.com/hook");
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = String(input);
      seen.push(href);
      if (init?.redirect !== "manual") {
        seen.push(evil);
        return new Response("leaked", { status: 200 });
      }
      return new Response(null, { status: 302, headers: { location: evil } });
    }) as typeof fetch;
    const result = await deliverDueWebhooks(db, {
      resolveSecret: async () => "secret",
      fetchImpl,
    });
    assert.equal(result.delivered, 0);
    assert.equal(result.failed, 1);
    assert.deepEqual(seen, ["https://example.com/hook"]);
    assert.match(errors.join(" "), /blocked|Private|link-local|metadata/i);
  }
});
