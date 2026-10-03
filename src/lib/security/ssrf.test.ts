import assert from "node:assert/strict";
import test from "node:test";
import { blockedDestination, fetchGuarded, redactSecrets } from "./ssrf.ts";

const blocked = [
  "ftp://example.com/file",
  "file:///etc/passwd",
  "http://localhost/admin",
  "http://foo.localhost/x",
  "http://metadata.google.internal/computeMetadata/v1/",
  "http://169.254.169.254/latest/meta-data",
  "http://0.0.0.0/",
  "http://[::1]/",
  "http://127.0.0.1/",
  "http://127.10.0.2/",
  "http://10.1.2.3/",
  "http://192.168.1.20/",
  "http://172.16.5.5/",
  "http://172.31.255.255/",
  "http://100.64.0.1/",
  "http://100.127.1.1/",
  "http://[fe80::1]/",
  "http://[fc00::1]/",
  "http://[fd00::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://[::ffff:169.254.169.254]/",
  "http://2130706433/",
  "http://012.0.0.1/",
  "http://010.1.1.1/",
  "https://user:password@example.com/private",
  "https://user@example.com/",
];

test("blocks private, metadata, obfuscated, and credentialed destinations", () => {
  for (const url of blocked) {
    assert.equal(typeof blockedDestination(url), "string", url);
  }
});

test("allows a public https URL", () => {
  assert.equal(blockedDestination("https://example.com"), null);
  assert.equal(blockedDestination("https://example.com/path?q=1"), null);
  assert.equal(blockedDestination("http://8.8.8.8/dns"), null);
  assert.equal(blockedDestination("http://172.32.0.1/"), null);
  assert.equal(blockedDestination("http://100.128.0.1/"), null);
});

test("redacts AWS keys, bearer tokens, and postgres passwords", () => {
  const raw = "key AKIAIOSFODNN7EXAMPLE auth Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig db postgres://user:password@db.internal/app";
  const redacted = redactSecrets(raw);
  assert.equal(redacted.includes("AKIA"), false);
  assert.equal(redacted.includes("eyJhbGci"), false);
  assert.equal(redacted.includes("password"), false);
  assert.equal(redacted.includes("***"), true);
  assert.equal(redacted.includes("db.internal"), true);
});

test("fetchGuarded does not follow a redirect to loopback or metadata", async () => {
  const hops = ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data"];
  for (const evil of hops) {
    const seen: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = String(input);
      seen.push(href);
      if (init?.redirect !== "manual") {
        seen.push(evil);
        return new Response("leaked", { status: 200 });
      }
      return new Response(null, { status: 302, headers: { location: evil } });
    }) as typeof fetch;
    await assert.rejects(
      () => fetchGuarded("https://example.com/hook", { method: "POST" }, fetchImpl),
      /blocked|Private|link-local|metadata/i,
    );
    assert.deepEqual(seen, ["https://example.com/hook"]);
    assert.equal(seen.includes(evil), false);
  }
});

test("fetchGuarded returns a direct public response and still forces manual redirects", async () => {
  let redirectMode: RequestRedirect | undefined;
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    redirectMode = init?.redirect;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  const response = await fetchGuarded("https://example.com/hook", { method: "POST", redirect: "follow" }, fetchImpl);
  assert.equal(response.status, 200);
  assert.equal(redirectMode, "manual");
});
