#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { verifyBackup } from "./backup.mjs";

const fixture = process.argv[2];
if (!fixture) {
  console.log("Usage: node scripts/verify-restore.mjs manifest-dir-or-json");
  process.exit(0);
}
const files = JSON.parse(readFileSync(fixture, "utf8"));
const result = verifyBackup(files);
if (!result.ok) {
  console.error(result.errors.join(","));
  process.exit(1);
}
console.log("restore checksums match");
