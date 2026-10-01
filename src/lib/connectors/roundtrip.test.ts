import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createTcp } from "node:net";
import test from "node:test";
import { ecmRoundTrip, oidcRoundTrip, s3RoundTrip, smtpRoundTrip } from "./roundtrip.ts";

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

test("smtp, oidc, s3, and ecm round-trip only when configured", async () => {
  const closed = await Promise.all([smtpRoundTrip({}), oidcRoundTrip({}), s3RoundTrip({}), ecmRoundTrip({ ECM_BASE_URL: "http://127.0.0.1:9", MERIDIAN_ENV: "production" })]);
  for (const result of closed) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "OFF");
  }

  const smtp = createTcp((socket) => {
    socket.on("error", () => undefined);
    let buffer = "";
    socket.write("220 local\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let end = buffer.indexOf("\n");
      while (end >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (line.startsWith("EHLO") || line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) socket.write("250 ok\r\n");
        else if (line === "DATA") socket.write("354 go\r\n");
        else if (line === ".") socket.write("250 queued\r\n");
        end = buffer.indexOf("\n");
      }
    });
  });
  smtp.on("error", () => undefined);
  const smtpPort = await new Promise<number>((resolve) => {
    smtp.listen(0, "127.0.0.1", () => {
      const address = smtp.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });

  const oidc = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ issuer: "http://issuer", authorization_endpoint: "http://issuer/auth", token_endpoint: "http://issuer/token" }));
  });
  const oidcPort = await listen(oidc);

  const objects = new Map<string, string>();
  const s3 = createServer(async (req, res) => {
    const key = req.url ?? "";
    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      objects.set(key, Buffer.concat(chunks).toString("utf8"));
      if (!String(req.headers.authorization ?? "").startsWith("AWS4-HMAC-SHA256")) {
        res.statusCode = 403;
        res.end("unsigned");
        return;
      }
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    const stored = objects.get(key);
    if (stored == null) {
      res.statusCode = 404;
      res.end("missing");
      return;
    }
    res.end(stored);
  });
  const s3Port = await listen(s3);

  const ecm = createServer(async (req, res) => {
    if (req.method === "PUT") {
      res.statusCode = 201;
      res.end("stored");
      return;
    }
    res.end("meridian");
  });
  const ecmPort = await listen(ecm);

  try {
    const mailed = await smtpRoundTrip({ SMTP_URL: `smtp://127.0.0.1:${smtpPort}` }, { body: "hello" });
    assert.equal(mailed.ok, true);
    const discovered = await oidcRoundTrip({ OIDC_ISSUER: `http://127.0.0.1:${oidcPort}`, OIDC_CLIENT_ID: "meridian" });
    assert.equal(discovered.ok, true);
    const stored = await s3RoundTrip({
      S3_ENDPOINT: `http://127.0.0.1:${s3Port}`,
      S3_BUCKET: "meridian",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_REGION: "us-east-1",
    });
    assert.equal(stored.ok, true);
    const filed = await ecmRoundTrip({ ECM_BASE_URL: `http://127.0.0.1:${ecmPort}`, ECM_ALLOW_PRIVATE: "1" });
    assert.equal(filed.ok, true);
  } finally {
    smtp.close();
    oidc.close();
    s3.close();
    ecm.close();
  }
});
