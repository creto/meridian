import assert from "node:assert/strict";
import test from "node:test";
import { createAllowlistScanner, createHeuristicScanner, scanResultIsBlocking } from "./scan.ts";

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

test("heuristic scanner flags EICAR and blocks infected verdicts", async () => {
  const scanner = createHeuristicScanner();
  const result = await scanner.scan(new TextEncoder().encode(`prefix ${EICAR}`), "text/plain");
  assert.equal(result.verdict, "infected");
  assert.equal(result.engine, "heuristic");
  assert.equal(result.reason, "eicar");
  assert.equal(scanResultIsBlocking(result.verdict), true);
  assert.equal(scanResultIsBlocking("clean"), false);
  assert.equal(scanResultIsBlocking("unknown"), false);
});

test("flags a PE executable disguised as png and accepts a real PDF", async () => {
  const scanner = createHeuristicScanner();
  const mz = Uint8Array.of(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00);
  const disguised = await scanner.scan(mz, "image/png");
  assert.equal(disguised.verdict, "infected");
  assert.equal(disguised.reason, "mz-pe");
  assert.equal(scanResultIsBlocking(disguised.verdict), true);
  const declaredExe = await scanner.scan(mz, "application/x-msdownload");
  assert.equal(declaredExe.verdict, "clean");
  const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  const clean = await scanner.scan(pdf, "application/pdf");
  assert.equal(clean.verdict, "clean");
  assert.equal(clean.engine, "heuristic");
  assert.equal(scanResultIsBlocking(clean.verdict), false);
});

test("flags ELF and HTML polyglots declared as documents", async () => {
  const scanner = createHeuristicScanner();
  const elf = Uint8Array.of(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01);
  assert.equal((await scanner.scan(elf, "application/octet-stream")).verdict, "infected");
  assert.equal((await scanner.scan(elf, "application/x-elf")).reason, "elf");
  const html = new TextEncoder().encode("<!DOCTYPE html><html><script>alert(1)</script></html>");
  const asPdf = await scanner.scan(html, "application/pdf");
  assert.equal(asPdf.verdict, "suspicious");
  assert.equal(asPdf.reason, "html-polyglot");
  const asPng = await scanner.scan(new TextEncoder().encode("  <script>x</script>"), "image/png");
  assert.equal(asPng.verdict, "suspicious");
  assert.equal((await scanner.scan(html, "text/html")).verdict, "clean");
});

test("allowlist returns suspicious mime or delegates", async () => {
  const gate = createAllowlistScanner(createHeuristicScanner(), ["application/pdf", "image/png"]);
  const pdf = new TextEncoder().encode("%PDF-1.4\n");
  const rejected = await gate.scan(new TextEncoder().encode(EICAR), "text/html");
  assert.equal(rejected.verdict, "suspicious");
  assert.equal(rejected.reason, "mime");
  assert.equal(rejected.engine, "allowlist");
  assert.equal(scanResultIsBlocking(rejected.verdict), true);
  const allowed = await gate.scan(pdf, "application/pdf");
  assert.equal(allowed.verdict, "clean");
  assert.equal(allowed.engine, "heuristic");
  const pe = await gate.scan(Uint8Array.of(0x4d, 0x5a), "image/png");
  assert.equal(pe.verdict, "infected");
});
