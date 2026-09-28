/** Runtime helpers that do not import the form engine (avoids a cycle). */

export function applyInputMask(mask: string, raw: string): string {
  if (!mask) return raw;
  const chars = raw.split("");
  let out = "";
  let index = 0;
  for (const token of mask) {
    if (index >= chars.length && !"9a*".includes(token)) {
      out += token;
      continue;
    }
    while (index < chars.length) {
      const char = chars[index]!;
      index += 1;
      const digit = /\d/.test(char);
      const letter = /[A-Za-z]/.test(char);
      if (token === "9" && digit) {
        out += char;
        break;
      }
      if (token === "a" && letter) {
        out += char;
        break;
      }
      if (token === "*" && (digit || letter)) {
        out += char;
        break;
      }
      if (!"9a*".includes(token)) {
        out += token;
        if (char !== token) index -= 1;
        break;
      }
    }
  }
  return out;
}

export function parseByteLimit(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  const scale = unit === "gb" ? 1024 ** 3 : unit === "mb" ? 1024 ** 2 : unit === "kb" ? 1024 : 1;
  return Math.round(amount * scale);
}

export function wordCount(value: string): number {
  const words = value.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function fileNameAllowed(pattern: string, name: string): boolean {
  if (!pattern.trim()) return true;
  const rules = pattern.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const lower = name.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return lower.endsWith(rule);
    if (rule.includes("/")) return lower.includes(rule);
    return lower.endsWith(`.${rule}`) || lower.includes(rule);
  });
}

export function applyCase(mode: unknown, value: string): string {
  if (mode === "uppercase") return value.toUpperCase();
  if (mode === "lowercase") return value.toLowerCase();
  return value;
}

export function collapseSpaces(enabled: unknown, value: string): string {
  return enabled === true ? value.replace(/ {2,}/g, " ") : value;
}

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a", "span", "div", "h1", "h2", "h3", "h4", "blockquote", "code", "pre"]);

export function sanitizeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag: string, attrs: string) => {
      const name = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (name === "br") return "<br>";
      if (name === "a") {
        const href = attrs.match(/href\s*=\s*"([^"]+)"/i)?.[1] ?? "";
        const safe = href.startsWith("https://") || href.startsWith("http://") || href.startsWith("/") ? href : "";
        return full.startsWith("</") ? "</a>" : safe ? `<a href="${safe.replace(/"/g, "")}" rel="noreferrer">` : "<a>";
      }
      return full.startsWith("</") ? `</${name}>` : `<${name}>`;
    });
}
