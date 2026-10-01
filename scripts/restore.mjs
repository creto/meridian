#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { verifyBackup } from "./backup.mjs";

const ORDER = ["tenants", "forms", "form_versions", "submissions", "workflow_tasks", "generated_documents", "audit_events", "jobs"];

export function planRestore(directory) {
  const names = readdirSync(directory);
  const files = {};
  for (const name of names) files[name] = readFileSync(`${directory}/${name}`, "utf8");
  const verified = verifyBackup(files);
  if (!verified.ok) throw new Error(`Checksum mismatch: ${verified.errors.join(",")}`);
  const statements = [];
  for (const table of ORDER) {
    const body = files[`${table}.jsonl`];
    if (body == null) continue;
    const rows = body.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    statements.push({ table, rows: rows.length });
  }
  return { ok: true, statements, createdAt: verified.manifest.createdAt };
}

if (process.argv[1] && process.argv[1].endsWith("restore.mjs")) {
  const dir = process.argv[2];
  if (!dir) {
    console.log("Usage: node scripts/restore.mjs <backup-dir>");
    process.exit(0);
  }
  console.log(JSON.stringify(planRestore(dir)));
}
