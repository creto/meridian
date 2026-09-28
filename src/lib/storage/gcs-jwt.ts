import { importPKCS8, SignJWT } from "jose";

/** Mint a Google service-account JWT. The caller exchanges it at the token endpoint. */
export async function mintGcsAssertion(clientEmail: string, privateKeyPem: string, now = Date.now()): Promise<string> {
  const key = await importPKCS8(privateKeyPem, "RS256");
  const seconds = Math.floor(now / 1000);
  return new SignJWT({ scope: "https://www.googleapis.com/auth/devstorage.full_control" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(seconds)
    .setExpirationTime(seconds + 3600)
    .sign(key);
}

export async function exchangeGcsAssertion(assertion: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; token: string } | { ok: false; message: string; status: number }> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) {
    return { ok: false, status: response.status, message: json.error_description || json.error || `Google token endpoint returned HTTP ${response.status}` };
  }
  return { ok: true, token: json.access_token };
}
