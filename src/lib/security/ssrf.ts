import { blockedTarget } from "../storage/ssrf.ts";

function extractRawHost(raw: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(raw.trim());
  if (!match?.[1]) return null;
  let authority = match[1];
  const at = authority.lastIndexOf("@");
  if (at >= 0) authority = authority.slice(at + 1);
  if (authority.startsWith("[")) {
    const end = authority.indexOf("]");
    return end >= 0 ? authority.slice(1, end) : authority;
  }
  return authority.split(":")[0] ?? "";
}

function looksLikeObfuscatedIp(host: string): boolean {
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (/^\d+$/.test(host)) return true;
  const parts = host.split(".");
  if (parts.length < 2 || parts.length > 4) return false;
  if (!parts.every((part) => /^(0x[0-9a-f]+|\d+)$/i.test(part))) return false;
  return parts.some((part) => /^0\d/.test(part) || /^0x/i.test(part));
}

function parseV4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;
  const nums = parts.map((part) => Number(part));
  if (!nums.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) return null;
  return nums;
}

function isBlockedV4(parts: number[]): boolean {
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function parseMappedV4(host: string): number[] | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(host);
  if (dotted?.[1]) return parseV4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!hex?.[1] || !hex[2]) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo)) return null;
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
}

function firstHextet(host: string): number | null {
  const first = host.split(":")[0] ?? "";
  if (!/^[0-9a-f]{1,4}$/i.test(first)) return null;
  return Number.parseInt(first, 16);
}

function blockedIpv6(host: string): string | null {
  if (!host.includes(":")) return null;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return "IPv6 loopback is blocked";
  const mapped = parseMappedV4(host);
  if (mapped && isBlockedV4(mapped)) return "IPv4-mapped private addresses are blocked";
  const first = firstHextet(host);
  if (first == null) return null;
  if (first >= 0xfe80 && first <= 0xfebf) return "IPv6 link-local addresses are blocked";
  if (first >= 0xfc00 && first <= 0xfdff) return "IPv6 unique-local addresses are blocked";
  return null;
}

/** Returns a rejection reason, or null when the URL is an acceptable public http(s) destination. */
export function blockedDestination(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Endpoint is not a valid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Only http and https endpoints are allowed";
  if (url.username || url.password) return "Credentials in the URL are blocked";

  const rawHost = extractRawHost(raw);
  if (rawHost && looksLikeObfuscatedIp(rawHost)) return "Obfuscated or numeric IP hosts are blocked";

  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/g, "").toLowerCase();
  if (!host) return "Endpoint is missing a host";
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal" || host === "0.0.0.0" || host === "::1") {
    return "Private and metadata hosts are blocked";
  }
  if (/^\d+$/.test(host)) return "Numeric IP hosts are blocked";

  const v4 = parseV4(host);
  if (v4 && isBlockedV4(v4)) return "Private and link-local addresses are blocked";
  const ipv6 = blockedIpv6(host);
  if (ipv6) return ipv6;

  return blockedTarget(raw);
}

export function redactSecrets(text: string): string {
  return text
    .replace(/AKIA[0-9A-Z]{16}/g, "***")
    .replace(/bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "***")
    .replace(/postgres:\/\/[^/\s:@]+:[^@\s/]+@/gi, "***");
}
