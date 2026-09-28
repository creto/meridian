export function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${rand}${time}`;
}

export function slugKey(input: string, fallback = "field"): string {
  const trimmed = input.trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return trimmed;
  const ascii = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
  if (!ascii) return fallback;
  const parts = ascii.split(/\s+/);
  const camel = parts
    .map((part, i) => {
      const lower = part.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  const safe = camel.replace(/^[0-9]+/, "");
  return /^[A-Za-z_]/.test(safe) ? safe : `f_${safe || fallback}`;
}

export function uniqueKey(base: string, taken: Set<string>): string {
  const root = slugKey(base);
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}${n}`)) n += 1;
  return `${root}${n}`;
}

export function isValidKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}
