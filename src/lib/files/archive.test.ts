import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Queryable } from "../platform/durable.ts";
import { listFiles, recordUpload, sanitizeFilename, sniffMime } from "./archive.ts";

function wrap(pg: PGlite): Queryable {
  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
  };
}

async function freshDb(): Promise<{ db: Queryable; pg: PGlite }> {
  const dir = mkdtempSync(join(tmpdir(), "meridian-files-"));
  const pg = new PGlite(dir);
  await pg.waitReady;
  for (const file of ["0001_meridian_platform.sql", "0002_domain.sql", "0003_enterprise.sql"]) {
    const sql = readFileSync(new URL(`../../../migrations/${file}`, import.meta.url), "utf8");
    await pg.exec(sql);
  }
  const db = wrap(pg);
  await db.query("insert into tenants (id, name) values ($1, $2), ($3, $4)", ["ten_a", "Tenant A", "ten_b", "Tenant B"]);
  return { db, pg };
}

test("sanitizeFilename strips paths and control characters", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("C:\\invoices\\Q3 report\u0000.pdf"), "Q3_report.pdf");
  assert.equal(sanitizeFilename("   "), "file");
  assert.equal(sanitizeFilename(""), "file");
  const long = sanitizeFilename(`${"a".repeat(200)}.pdf`);
  assert.ok(long.length <= 120);
  assert.match(long, /^[A-Za-z0-9._-]+$/);
});

test("sniffMime flags a declared pdf that is not a PDF", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const sniffed = sniffMime(png, "application/pdf");
  assert.equal(sniffed.mismatch, true);
  assert.equal(sniffed.mime, "image/png");
  const pdf = new TextEncoder().encode("%PDF-1.7\n");
  const ok = sniffMime(pdf, "application/pdf");
  assert.equal(ok.mismatch, false);
  assert.equal(ok.mime, "application/pdf");
});

test("mime mismatch is quarantined and tenants cannot see each other's files", async () => {
  const { db, pg } = await freshDb();
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\ntrailer\n<<>>\n%%EOF\n");
  const quarantined = await recordUpload(db, "ten_a", {
    workspaceId: "ws_a",
    submissionId: "sub_1",
    fieldKey: "attachment",
    filename: "../weird\u0000 invoice.pdf",
    declaredMime: "image/png",
    bytes: pdf,
    provider: "memory",
    objectKey: "ten_a/sub_1/bad",
    createdBy: "usr_a",
  });
  assert.equal(quarantined.status, "QUARANTINED");

  const ready = await recordUpload(db, "ten_a", {
    workspaceId: "ws_a",
    submissionId: "sub_1",
    fieldKey: "attachment",
    filename: "invoice.pdf",
    declaredMime: "application/pdf",
    bytes: pdf,
    provider: "memory",
    objectKey: "ten_a/sub_1/good",
    createdBy: "usr_a",
  });
  assert.equal(ready.status, "READY");

  const otherTenant = await recordUpload(db, "ten_b", {
    workspaceId: "ws_b",
    submissionId: "sub_1",
    fieldKey: "attachment",
    filename: "secret.pdf",
    declaredMime: "application/pdf",
    bytes: pdf,
    provider: "memory",
    objectKey: "ten_b/sub_1/secret",
    createdBy: "usr_b",
  });
  assert.equal(otherTenant.status, "READY");

  const tenantA = await listFiles(db, "ten_a", "sub_1");
  assert.equal(tenantA.length, 2);
  assert.ok(tenantA.every((row) => row.tenant_id === "ten_a"));
  assert.equal(tenantA.find((row) => row.id === quarantined.id)?.status, "QUARANTINED");
  assert.equal(tenantA.find((row) => row.id === quarantined.id)?.mime, "application/pdf");
  assert.equal(tenantA.find((row) => row.id === ready.id)?.status, "READY");
  assert.match(tenantA.find((row) => row.id === quarantined.id)?.sanitized_filename ?? "", /^[A-Za-z0-9._-]+$/);

  const tenantB = await listFiles(db, "ten_b", "sub_1");
  assert.equal(tenantB.length, 1);
  assert.equal(tenantB[0]?.id, otherTenant.id);
  assert.ok(!tenantB.some((row) => row.tenant_id === "ten_a"));

  const versions = await db.query<{ version: number; tenant_id: string }>(
    "select version, tenant_id from file_versions where file_id = $1",
    [ready.id],
  );
  assert.equal(versions.length, 1);
  assert.equal(versions[0]?.version, 1);
  assert.equal(versions[0]?.tenant_id, "ten_a");
  await pg.close();
});
