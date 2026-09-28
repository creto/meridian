const WIN: Record<string, number> = {
  "á": 0xe1, "é": 0xe9, "í": 0xed, "ó": 0xf3, "ú": 0xfa, "ñ": 0xf1, "ü": 0xfc,
  "Á": 0xc1, "É": 0xc9, "Í": 0xcd, "Ó": 0xd3, "Ú": 0xda, "Ñ": 0xd1, "Ü": 0xdc,
  "¿": 0xbf, "¡": 0xa1, "°": 0xb0, "–": 0x96, "—": 0x97, "“": 0x93, "”": 0x94,
  "‘": 0x91, "’": 0x92,
};

function pdfText(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = WIN[ch] ?? ch.charCodeAt(0);
    const byte = code > 255 ? 63 : code;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word.length > width ? word.slice(0, width) : word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
}

export function buildPdf(lines: PdfLine[], meta: { title: string }): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const pages: string[][] = [];
  let current: string[] = [];
  let y = pageHeight - margin;

  const flush = () => {
    pages.push(current);
    current = [];
    y = pageHeight - margin;
  };

  const draw = (text: string, size: number, gap: number) => {
    if (y < margin + 24) flush();
    current.push(`BT /F1 ${size} Tf 1 0 0 1 ${margin} ${y} Tm (${pdfText(text)}) Tj ET`);
    y -= gap;
  };

  draw(meta.title, 16, 22);
  current.push(`0.14 0.19 0.27 RG`);
  current.push(`${margin} ${y + 8} m ${pageWidth - margin} ${y + 8} l S`);
  y -= 10;

  for (const line of lines) {
    const size = line.size ?? 10;
    const gap = line.gap ?? size + 5;
    const chunks = wrap(line.text, size > 13 ? 62 : 88);
    if (line.bold) chunks.forEach((chunk, i) => draw(chunk, size, i === chunks.length - 1 ? gap : size + 3));
    else chunks.forEach((chunk, i) => draw(chunk, size, i === chunks.length - 1 ? gap : size + 3));
  }

  if (current.length) pages.push(current);
  if (pages.length === 0) pages.push([`BT /F1 12 Tf 54 740 Td (Empty) Tj ET`]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  // 1 catalog, 2 pages, 3 font, then pairs of page/content
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let nextId = 4;
  for (const content of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const stream = content.join("\n");
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  const max = objects.length - 1;
  for (let id = 1; id <= max; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id] ?? "<<>>"}\nendobj\n`;
  }
  const xrefAt = body.length;
  let xref = `xref\n0 ${max + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let id = 1; id <= max; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += xref;
  body += `trailer << /Size ${max + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(body);
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((item) => typeof item === "string" || typeof item === "number")) return value.join(", ");
    return value
      .map((item, index) => {
        if (!item || typeof item !== "object") return `${index + 1}. ${String(item)}`;
        const rec = item as Record<string, unknown>;
        const parts = Object.entries(rec)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => `${k}: ${formatValue(v)}`);
        return `${index + 1}. ${parts.join("; ")}`;
      })
      .join("  ");
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if ("name" in rec && "sha256" in rec) return `${String(rec.name)} (${String(rec.sha256).slice(0, 10)}…)`;
    return Object.entries(rec)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join(", ");
  }
  return String(value);
}

export async function submissionPdf(input: {
  title: string;
  name: string;
  version: number;
  submissionId: string;
  data: Record<string, unknown>;
  labels: { key: string; label: string }[];
}): Promise<{ bytes: Uint8Array; sha256: string }> {
  const lines: PdfLine[] = [
    { text: `${input.name}  ·  version ${input.version}`, size: 9, gap: 16 },
    { text: `Submission ${input.submissionId}`, size: 9, gap: 18 },
  ];
  for (const field of input.labels) {
    lines.push({ text: field.label, size: 9, gap: 12 });
    lines.push({ text: formatValue(input.data[field.key]), size: 11, gap: 16 });
  }
  lines.push({ text: `Form version ${input.version}. Template is the built-in record layout (not an uploaded PDF).`, size: 8, gap: 12 });
  lines.push({ text: "Generated by Meridian. This is a filled record, not a cryptographic signature.", size: 8, gap: 12 });
  const bytes = buildPdf(lines, { title: input.title });
  const sha256 = await sha256Bytes(bytes);
  return { bytes, sha256 };
}

export function downloadBytes(bytes: Uint8Array, filename: string, type = "application/pdf") {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
