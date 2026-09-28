/** Block obvious SSRF targets unless the connector explicitly opts in. */
export function blockedTarget(raw: string, allowPrivate = false): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Endpoint is not a valid URL";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only http and https endpoints are allowed";
  if (allowPrivate) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1" || host === "metadata.google.internal") {
    return "Private and metadata hosts are blocked. Set allowPrivate only for an explicit local connector.";
  }
  const v4 = host.split(".").map((part) => Number(part));
  if (v4.length === 4 && v4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = v4;
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) {
      return "Private and link-local addresses are blocked";
    }
  }
  return null;
}
