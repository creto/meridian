#!/usr/bin/env node
/**
 * Logical backup of named tables to JSONL.
 * RPO is the time since the last successful run of this script. This tool does not
 * enforce a recovery-point objective. RTO depends on database size and the operator.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const TABLES = ["tenants", "forms", "form_versions", "submissions", "workflow_tasks", "generated_documents", "audit_events", "jobs"];

export function checksum(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function backupFromRows(tables) {
  const files = {};
  for (const [name, rows] of Object.entries(tables)) {
    const body = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
    files[`${name}.jsonl`] = body;
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    tables: Object.keys(tables),
    checksums: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, checksum(body)])),
    note: "Restore order is tenants, forms, form_versions, submissions, then workflow and documents.",
  };
  files["manifest.json"] = JSON.stringify(manifest, null, 2);
  return files;
}

export function verifyBackup(files) {
  const manifest = JSON.parse(files["manifest.json"]);
  const errors = [];
  for (const [name, expected] of Object.entries(manifest.checksums)) {
    if (checksum(files[name] ?? "") !== expected) errors.push(name);
  }
  return { ok: errors.length === 0, errors, manifest };
}

function main() {
  const fixture = process.argv.includes("--fixture") ? process.argv[process.argv.indexOf("--fixture") + 1] : null;
  const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "backup-out";
  if (!fixture) {
    console.log("Pass --fixture rows.json to back up without a database. DATABASE_URL dumps are operator-run.");
    process.exit(0);
  }
  const rows = JSON.parse(readFileSync(fixture, "utf8"));
  const files = backupFromRows(rows);
  mkdirSync(out, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(`${out}/${name}`, body);
  const verified = verifyBackup(files);
  if (!verified.ok) {
    console.error(verified.errors.join(","));
    process.exit(1);
  }
  console.log(`backed up ${verified.manifest.tables.length} tables`);
}

if (process.argv[1] && process.argv[1].endsWith("backup.mjs")) main();
