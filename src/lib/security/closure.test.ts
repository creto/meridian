import assert from "node:assert/strict";
import test from "node:test";
import { appendAudit, verifyAuditChain, type Queryable } from "../platform/durable.ts";
import { blockedDestination, redactSecrets } from "./ssrf.ts";
import { SlidingWindowLimiter, escapeHtml, issueCsrfToken, verifyCsrfToken } from "./http.ts";

interface AuditRow {
  seq: number;
  actor: string;
  action: string;
  target: string;
  detail: string | null;
  prev_hash: string;
  hash: string;
  tenant_id: string;
}

function memoryDb(): Queryable & { rows: AuditRow[] } {
  const rows: AuditRow[] = [];
  return {
    rows,
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      if (text.startsWith("select seq, hash")) {
        const tenant = String(params[0]);
        const mine = rows.filter((row) => row.tenant_id === tenant).sort((a, b) => b.seq - a.seq);
        return (mine[0] ? [{ seq: mine[0].seq, hash: mine[0].hash }] : []) as T[];
      }
      if (text.startsWith("insert into audit_events")) {
        rows.push({
          tenant_id: String(params[1]),
          seq: Number(params[2]),
          actor: String(params[3]),
          action: String(params[4]),
          target: String(params[5]),
          detail: params[6] == null ? null : String(params[6]),
          prev_hash: String(params[7]),
          hash: String(params[8]),
        });
        return [] as T[];
      }
      if (text.startsWith("select seq, actor")) {
        const tenant = String(params[0]);
        return rows.filter((row) => row.tenant_id === tenant).sort((a, b) => a.seq - b.seq) as T[];
      }
      throw new Error(`unexpected sql: ${text}`);
    },
  };
}

test("audit chain detects a tampered event and ignores another tenant", async () => {
  const db = memoryDb();
  await appendAudit(db, "ten_a", { actor: "ada", action: "publish", target: "form_1" });
  await appendAudit(db, "ten_a", { actor: "ada", action: "submit", target: "sub_1", detail: "ok" });
  await appendAudit(db, "ten_b", { actor: "bob", action: "publish", target: "form_9" });
  const sound = await verifyAuditChain(db, "ten_a");
  assert.equal(sound.ok, true);
  assert.equal(sound.checked, 2);
  db.rows[0]!.detail = "tampered";
  const broken = await verifyAuditChain(db, "ten_a");
  assert.equal(broken.ok, false);
  const other = await verifyAuditChain(db, "ten_b");
  assert.equal(other.ok, true);
});

test("csrf tokens are bound to a session and expire", () => {
  const token = issueCsrfToken("secret", "sess_1", 1_000, 50);
  assert.equal(verifyCsrfToken("secret", "sess_1", token, 1_040), true);
  assert.equal(verifyCsrfToken("secret", "sess_2", token, 1_040), false);
  assert.equal(verifyCsrfToken("secret", "sess_1", token, 1_200), false);
  assert.equal(verifyCsrfToken("secret", "sess_1", `${token}x`, 1_040), false);
});

test("ssrf blocks metadata addresses and redacts secrets", () => {
  assert.ok(blockedDestination("http://169.254.169.254/latest/meta-data"));
  assert.ok(blockedDestination("http://127.0.0.1:8080/admin"));
  assert.equal(blockedDestination("https://example.com/hook"), null);
  const redacted = redactSecrets("key AKIAIOSFODNN7EXAMPLE auth Bearer abc.def.ghi db postgres://user:password@db.internal/app");
  assert.equal(redacted.includes("AKIA"), false);
  assert.equal(redacted.includes("password"), false);
});

test("html escape and the rate limiter", () => {
  assert.equal(escapeHtml(`<script>"&'</script>`).includes("<"), false);
  const limiter = new SlidingWindowLimiter(2, 1_000);
  assert.equal(limiter.allow("ip", 0).ok, true);
  assert.equal(limiter.allow("ip", 10).ok, true);
  assert.equal(limiter.allow("ip", 20).ok, false);
  assert.equal(limiter.allow("other", 20).ok, true);
  assert.equal(limiter.allow("ip", 2_000).ok, true);
});
