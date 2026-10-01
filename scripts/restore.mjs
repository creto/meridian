#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { verifyBackup } from "./backup.mjs";

export const ORDER = ["tenants", "workspaces", "forms", "form_versions", "submissions", "workflow_tasks", "generated_documents", "audit_events", "jobs"];

const IDENT = /^[a-z_][a-z0-9_]*$/;

export function loadBackup(directory) {
  const names = readdirSync(directory);
  const files = {};
  for (const name of names) files[name] = readFileSync(`${directory}/${name}`, "utf8");
  const verified = verifyBackup(files);
  if (!verified.ok) throw new Error(`Checksum mismatch: ${verified.errors.join(",")}`);
  const tables = {};
  for (const table of ORDER) {
    const body = files[`${table}.jsonl`];
    if (body == null) continue;
    tables[table] = body.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  }
  return { ok: true, tables, createdAt: verified.manifest.createdAt };
}

export function planRestore(directory) {
  const loaded = loadBackup(directory);
  return {
    ok: true,
    createdAt: loaded.createdAt,
    statements: ORDER.filter((table) => loaded.tables[table]).map((table) => ({ table, rows: loaded.tables[table].length })),
  };
}

function valueOf(value) {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

/** Insert a verified backup. `query` is node-pg or any client that accepts (sql, params). */
export async function applyRestore(query, directory) {
  const loaded = loadBackup(directory);
  await query("begin");
  try {
    const inserted = [];
    for (const table of ORDER) {
      const rows = loaded.tables[table] ?? [];
      if (!IDENT.test(table)) throw new Error(`Refusing table ${table}`);
      let count = 0;
      for (const row of rows) {
        const cols = Object.keys(row).filter((col) => IDENT.test(col));
        if (cols.length === 0) continue;
        const placeholders = cols.map((_, index) => `$${index + 1}`);
        await query(
          `insert into ${table} (${cols.join(", ")}) values (${placeholders.join(", ")}) on conflict do nothing`,
          cols.map((col) => valueOf(row[col])),
        );
        count += 1;
      }
      if (rows.length) inserted.push({ table, rows: count });
    }
    await query("commit");
    return { ok: true, inserted, createdAt: loaded.createdAt };
  } catch (error) {
    await query("rollback");
    throw error;
  }
}

if (process.argv[1] && process.argv[1].endsWith("restore.mjs")) {
  const dir = process.argv[2];
  if (!dir) {
    console.log("Usage: node scripts/restore.mjs <backup-dir>");
    process.exit(0);
  }
  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify(planRestore(dir)));
    process.exit(0);
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await applyRestore((sql, params) => client.query(sql, params), dir);
    console.log(JSON.stringify(result));
  } finally {
    await client.end();
  }
}
