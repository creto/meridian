import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { chromium } from "playwright";

process.env.MERIDIAN_DISABLE_PUMP = "1";

test("a browser reads the live health page", async () => {
  const { handleAgent } = await import("../src/lib/platform/agent-http.ts");
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(`<!doctype html><title>Meridian</title><main id="status">waiting</main>
        <script>fetch("/api/agent/v1/health/live").then((r)=>r.json()).then((body)=>{document.querySelector("#status").textContent=body.status}).catch(()=>{document.querySelector("#status").textContent="error"})</script>`);
      return;
    }
    const response = await handleAgent(req.method ?? "GET", url.pathname.replace(/^\/api\/agent\/v1\//, ""), new Request(`http://127.0.0.1${url.pathname}`));
    res.statusCode = response.status;
    res.setHeader("content-type", response.headers.get("content-type") ?? "application/json");
    res.end(await response.text());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => document.querySelector("#status")?.textContent === "live");
    assert.equal(await page.locator("#status").textContent(), "live");
    assert.equal(await page.title(), "Meridian");
  } finally {
    await browser.close();
    server.close();
  }
});
