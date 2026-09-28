export type ScanVerdict = "clean" | "suspicious" | "infected" | "unknown";

export interface ScanResult {
  verdict: ScanVerdict;
  engine: string;
  reason?: string;
}

export interface MalwareScanner {
  scan(bytes: Uint8Array, declaredMime: string): Promise<ScanResult>;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

const EXECUTABLE_MIMES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/vnd.microsoft.portable-executable",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-elf",
  "application/x-sharedlib",
  "application/x-mach-binary",
  "application/x-pie-executable",
]);

function baseMime(declaredMime: string): string {
  return declaredMime.split(";")[0]?.trim().toLowerCase() ?? "";
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function textStart(bytes: Uint8Array): string {
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
  return latin1(bytes.subarray(offset, offset + 64)).trimStart().toLowerCase();
}

function isHtmlPolyglot(bytes: Uint8Array): boolean {
  const head = textStart(bytes);
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<script");
}

/** Heuristic gate only. A clean result is not a claim that bytes are safe to execute. */
export function createHeuristicScanner(): MalwareScanner {
  return {
    async scan(bytes, declaredMime) {
      const mime = baseMime(declaredMime);
      if (latin1(bytes).includes(EICAR)) {
        return { verdict: "infected", engine: "heuristic", reason: "eicar" };
      }
      if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
        return { verdict: "infected", engine: "heuristic", reason: "elf" };
      }
      if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a && !EXECUTABLE_MIMES.has(mime)) {
        return { verdict: "infected", engine: "heuristic", reason: "mz-pe" };
      }
      if ((mime === "image/png" || mime === "application/pdf") && isHtmlPolyglot(bytes)) {
        return { verdict: "suspicious", engine: "heuristic", reason: "html-polyglot" };
      }
      return { verdict: "clean", engine: "heuristic" };
    },
  };
}

export function createAllowlistScanner(inner: MalwareScanner, allowedMimes: string[]): MalwareScanner {
  const allowed = new Set(allowedMimes.map((mime) => baseMime(mime)));
  return {
    async scan(bytes, declaredMime) {
      if (!allowed.has(baseMime(declaredMime))) {
        return { verdict: "suspicious", engine: "allowlist", reason: "mime" };
      }
      return inner.scan(bytes, declaredMime);
    },
  };
}

export function scanResultIsBlocking(verdict: ScanVerdict): boolean {
  return verdict === "suspicious" || verdict === "infected";
}
