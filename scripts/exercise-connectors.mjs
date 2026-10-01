#!/usr/bin/env node
/** Start local SMTP, OIDC, S3, and ECM listeners and require each round trip to succeed. */
import { createServer } from "node:http";
import { createServer as createTcp } from "node:net";
import { ecmRoundTrip, oidcRoundTrip, s3RoundTrip, smtpRoundTrip } from "../src/lib/connectors/roundtrip.ts";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
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
const smtpPort = await listen(smtp);

const oidc = createServer((_req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ issuer: "http://127.0.0.1", authorization_endpoint: "http://127.0.0.1/auth", token_endpoint: "http://127.0.0.1/token" }));
});
const oidcPort = await listen(oidc);

const objects = new Map();
const s3 = createServer(async (req, res) => {
  const key = req.url ?? "";
  if (req.method === "PUT") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!String(req.headers.authorization ?? "").startsWith("AWS4-HMAC-SHA256")) {
      res.statusCode = 403;
      res.end("unsigned");
      return;
    }
    objects.set(key, Buffer.concat(chunks).toString("utf8"));
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

const ecm = createServer((_req, res) => {
  res.statusCode = _req.method === "PUT" ? 201 : 200;
  res.end("meridian");
});
const ecmPort = await listen(ecm);

const env = {
  SMTP_URL: `smtp://127.0.0.1:${smtpPort}`,
  OIDC_ISSUER: `http://127.0.0.1:${oidcPort}`,
  OIDC_CLIENT_ID: "meridian",
  S3_ENDPOINT: `http://127.0.0.1:${s3Port}`,
  S3_BUCKET: "meridian",
  S3_ACCESS_KEY_ID: "local-key",
  S3_SECRET_ACCESS_KEY: "local-secret",
  S3_REGION: "us-east-1",
  ECM_BASE_URL: `http://127.0.0.1:${ecmPort}`,
  ECM_ALLOW_PRIVATE: "1",
};

try {
  const results = {
    smtp: await smtpRoundTrip(env, { body: "live" }),
    oidc: await oidcRoundTrip(env),
    s3: await s3RoundTrip(env),
    ecm: await ecmRoundTrip(env),
  };
  const ok = Object.values(results).every((result) => result.ok);
  console.log(JSON.stringify({ ok, results }));
  process.exitCode = ok ? 0 : 1;
} finally {
  smtp.close();
  oidc.close();
  s3.close();
  ecm.close();
}
