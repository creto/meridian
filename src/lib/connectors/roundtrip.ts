import { connect } from "node:net";
import { sha256Hex, signAws } from "../storage/sigv4.ts";
import { putRest } from "../storage/providers.ts";

export type RoundTrip =
  | { ok: true; protocol: "smtp" | "oidc" | "s3" | "ecm"; detail: string }
  | { ok: false; code: "OFF" | "FAILED"; message: string };

function off(message: string): RoundTrip {
  return { ok: false, code: "OFF", message };
}

function failed(message: string): RoundTrip {
  return { ok: false, code: "FAILED", message };
}

function readLine(socket: import("node:net").Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const end = buf.indexOf("\n");
      if (end < 0) return;
      socket.off("data", onData);
      resolve(buf.slice(0, end).replace(/\r$/, ""));
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

function send(socket: import("node:net").Socket, line: string): void {
  socket.write(`${line}\r\n`);
}

/** Speak SMTP. Without SMTP_URL the path stays off and nothing is marked sent. */
export async function smtpRoundTrip(env: NodeJS.ProcessEnv, mail: { to?: string; subject?: string; body?: string } = {}): Promise<RoundTrip> {
  const raw = env.SMTP_URL?.trim();
  if (!raw) return off("SMTP_URL is not configured");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return failed("SMTP_URL is not a URL");
  }
  const port = Number(url.port || 25);
  const host = url.hostname;
  if (!host || !Number.isFinite(port)) return failed("SMTP_URL is missing a host");
  const socket = connect({ host, port });
  socket.on("error", () => undefined);
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", reject);
    });
    const banner = await readLine(socket);
    if (!banner.startsWith("220")) return failed(banner || "SMTP banner was refused");
    send(socket, "EHLO meridian");
    const ehlo = await readLine(socket);
    if (!ehlo.startsWith("250")) return failed(ehlo || "EHLO was refused");
    send(socket, "MAIL FROM:<meridian@localhost>");
    const from = await readLine(socket);
    if (!from.startsWith("250")) return failed(from || "MAIL FROM was refused");
    send(socket, `RCPT TO:<${mail.to ?? "inbox@localhost"}>`);
    const rcpt = await readLine(socket);
    if (!rcpt.startsWith("250")) return failed(rcpt || "RCPT TO was refused");
    send(socket, "DATA");
    const data = await readLine(socket);
    if (!data.startsWith("354")) return failed(data || "DATA was refused");
    send(socket, `Subject: ${mail.subject ?? "Meridian"}`);
    send(socket, "");
    send(socket, mail.body ?? "meridian");
    send(socket, ".");
    const queued = await readLine(socket);
    if (!queued.startsWith("250")) return failed(queued || "Message was not accepted");
    send(socket, "QUIT");
    return { ok: true, protocol: "smtp", detail: queued };
  } catch (error) {
    return failed(error instanceof Error ? error.message : "SMTP connection failed");
  } finally {
    socket.end();
  }
}

/** Fetch the provider discovery document. Missing issuer or client id stays off. */
export async function oidcRoundTrip(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): Promise<RoundTrip> {
  const issuer = env.OIDC_ISSUER?.trim().replace(/\/$/, "");
  if (!issuer || !env.OIDC_CLIENT_ID?.trim()) return off("OIDC_ISSUER and OIDC_CLIENT_ID are required");
  try {
    const response = await fetchImpl(`${issuer}/.well-known/openid-configuration`);
    if (!response.ok) return failed(`OIDC discovery returned HTTP ${response.status}`);
    const doc = (await response.json()) as { issuer?: string; authorization_endpoint?: string; token_endpoint?: string };
    if (!doc.authorization_endpoint || !doc.token_endpoint) return failed("OIDC discovery is missing authorization or token endpoints");
    return { ok: true, protocol: "oidc", detail: doc.issuer || issuer };
  } catch (error) {
    return failed(error instanceof Error ? error.message : "OIDC discovery failed");
  }
}

/** Signed PUT then GET. Missing bucket or keys stays off. */
export async function s3RoundTrip(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): Promise<RoundTrip> {
  const endpoint = env.S3_ENDPOINT?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return off("S3 endpoint, bucket, and keys are required");
  let base: URL;
  try {
    base = new URL(endpoint);
  } catch {
    return failed("S3_ENDPOINT is not a URL");
  }
  const body = "meridian";
  const payloadHash = await sha256Hex(body);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const path = `/${bucket}/meridian-healthcheck.txt`;
  const signed = await signAws({
    method: "PUT",
    host: base.host,
    path,
    payloadHash,
    accessKeyId,
    secretAccessKey,
    region: env.S3_REGION?.trim() || "us-east-1",
    amzDate,
  });
  const put = await fetchImpl(`${base.origin}${path}`, {
    method: "PUT",
    headers: {
      host: base.host,
      authorization: signed.authorization,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    },
    body,
  });
  if (!put.ok) return failed(`S3 PUT returned HTTP ${put.status}`);
  const get = await fetchImpl(`${base.origin}${path}`);
  if (!get.ok) return failed(`S3 GET returned HTTP ${get.status}`);
  const stored = await get.text();
  if (stored !== body) return failed("S3 GET did not return the uploaded object");
  return { ok: true, protocol: "s3", detail: path };
}

/** PUT a health object. Production never follows a private address. */
export async function ecmRoundTrip(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): Promise<RoundTrip> {
  const endpoint = env.ECM_BASE_URL?.trim();
  if (!endpoint) return off("ECM_BASE_URL is not configured");
  const allowPrivate = env.MERIDIAN_ENV !== "production" && env.ECM_ALLOW_PRIVATE === "1";
  const result = await putRest(
    { endpoint, bearer: env.ECM_BEARER?.trim(), allowPrivate },
    { key: "meridian-healthcheck.txt", body: new TextEncoder().encode("meridian"), contentType: "text/plain" },
  );
  if (!result.ok) return result.code === "NOT_CONFIGURED" || result.code === "SSRF_BLOCKED" ? off(result.message) : failed(result.message);
  const check = await fetchImpl(result.url ?? endpoint);
  if (!check.ok) return failed(`ECM read returned HTTP ${check.status}`);
  return { ok: true, protocol: "ecm", detail: result.key };
}
