#!/usr/bin/env node
/**
 * Calls a running Meridian. Base URL defaults to the preview.
 * GET /api/platform/connectors does not need a credential.
 */
const base = process.env.MERIDIAN_BASE ?? "http://127.0.0.1:8080";

const connectors = await fetch(`${base}/api/platform/connectors`);
const body = await connectors.json();
const names = Array.isArray(body.connectors) ? body.connectors.map((item) => item.connector).filter(Boolean) : [];
console.log(JSON.stringify({ status: connectors.status, connectors: names.length }));
if (!connectors.ok || names.length < 1) process.exit(1);
