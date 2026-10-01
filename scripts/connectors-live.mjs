#!/usr/bin/env node
/** Exit 0 only when every configured connector answers. Missing credentials stay off. */
const required = {
  smtp: ["SMTP_URL"],
  oidc: ["OIDC_ISSUER", "OIDC_CLIENT_ID"],
  s3: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
  ecm: ["ECM_BASE_URL"],
};

const status = {};
for (const [name, keys] of Object.entries(required)) {
  status[name] = keys.every((key) => process.env[key]?.trim()) ? "configured" : "off";
}
const pending = Object.entries(status).filter(([, value]) => value === "off").map(([name]) => name);
if (pending.length) {
  console.log(JSON.stringify({ ok: false, status, message: `${pending.join(", ")} stay off until credentials are set` }));
  process.exit(2);
}

const { ecmRoundTrip, oidcRoundTrip, s3RoundTrip, smtpRoundTrip } = await import("../src/lib/connectors/roundtrip.ts");
const results = {
  smtp: await smtpRoundTrip(process.env),
  oidc: await oidcRoundTrip(process.env),
  s3: await s3RoundTrip(process.env),
  ecm: await ecmRoundTrip(process.env),
};
const ok = Object.values(results).every((result) => result.ok);
console.log(JSON.stringify({ ok, results }));
process.exit(ok ? 0 : 1);
