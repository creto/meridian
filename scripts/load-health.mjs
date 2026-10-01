#!/usr/bin/env node
/** Time concurrent reads of the live health route. This is this machine, not a public deployment. */
import { createServer } from "node:http";

process.env.MERIDIAN_DISABLE_PUMP = "1";
const { handleAgent } = await import("../src/lib/platform/agent-http.ts");

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const response = await handleAgent(req.method ?? "GET", url.pathname.replace(/^\/api\/agent\/v1\//, ""), new Request(`http://127.0.0.1${url.pathname}`));
  res.statusCode = response.status;
  res.end(await response.text());
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const url = `http://127.0.0.1:${port}/api/agent/v1/health/live`;
const total = 100;
const workers = 10;
const started = performance.now();
let ok = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  for (let index = 0; index < total / workers; index += 1) {
    const response = await fetch(url);
    if (response.ok) ok += 1;
  }
}));
const ms = Math.round(performance.now() - started);
console.log(JSON.stringify({ ok, total, ms, rps: Math.round((ok / ms) * 1000) }));
server.close();
