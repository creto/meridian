#!/usr/bin/env node
/**
 * Loads the custom element source and checks the public attributes.
 * A browser is required to upgrade the element; this file does not claim a browser run.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../packages/web-component/meridian-form.js"), "utf8");
const attributes = ["form-id", "api-base", "theme", "locale", "mode", "auth-token", "submission-id"];
const events = ["meridian-ready", "meridian-change", "meridian-submit", "meridian-error"];
const missing = [...attributes, ...events].filter((token) => !source.includes(token));
console.log(JSON.stringify({ attributes: attributes.length, events: events.length, missing }));
if (missing.length) process.exit(1);
