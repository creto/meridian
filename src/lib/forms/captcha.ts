import type { FormComponent } from "./types.ts";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGES = 400;

export interface CaptchaGlyph {
  text: string;
  x: number;
  y: number;
  rotate: number;
}

export interface CaptchaLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Drawn by the runtime. The answer is not on this object. */
export interface CaptchaChallenge {
  id: string;
  expiresAt: number;
  width: number;
  height: number;
  glyphs: CaptchaGlyph[];
  lines: CaptchaLine[];
}

interface StoredChallenge {
  answer: string;
  expiresAt: number;
}

export interface CaptchaVerdict {
  ok: boolean;
  message: string;
}

const challenges = new Map<string, StoredChallenge>();

function randomIndex(span: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % span;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function prune(now: number) {
  for (const [id, item] of challenges) {
    if (item.expiresAt <= now) challenges.delete(id);
  }
  while (challenges.size > MAX_CHALLENGES) {
    const oldest = challenges.keys().next().value;
    if (!oldest) break;
    challenges.delete(oldest);
  }
}

export function issueCaptcha(ttlMs = DEFAULT_TTL_MS, now = Date.now()): CaptchaChallenge {
  prune(now);
  const chars = Array.from({ length: 5 }, () => ALPHABET[randomIndex(ALPHABET.length)]!);
  const id = randomId();
  const width = 220;
  const height = 64;
  const glyphs = chars.map((text, index) => ({
    text,
    x: 18 + index * 40,
    y: 40 + randomIndex(9),
    rotate: randomIndex(31) - 15,
  }));
  const lines = Array.from({ length: 4 }, () => ({
    x1: randomIndex(width),
    y1: randomIndex(height),
    x2: randomIndex(width),
    y2: randomIndex(height),
  }));
  challenges.set(id, { answer: chars.join(""), expiresAt: now + ttlMs });
  return { id, expiresAt: now + ttlMs, width, height, glyphs, lines };
}

export function readCaptcha(value: unknown): { id: string; answer: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { id?: unknown; answer?: unknown };
  if (typeof record.id !== "string" || !record.id) return null;
  if (typeof record.answer !== "string") return null;
  return { id: record.id, answer: record.answer };
}

function matches(expected: string, given: string): boolean {
  const left = expected.toUpperCase();
  const right = given.trim().toUpperCase();
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function checkCaptcha(id: string, answer: string, now = Date.now()): CaptchaVerdict {
  const stored = challenges.get(id);
  if (!stored) return { ok: false, message: "Refresh the captcha and try again" };
  if (stored.expiresAt <= now) {
    challenges.delete(id);
    return { ok: false, message: "That captcha expired. Refresh it and try again" };
  }
  if (!matches(stored.answer, answer)) return { ok: false, message: "Those characters do not match" };
  return { ok: true, message: "" };
}

export function consumeCaptcha(id: string, answer: string, now = Date.now()): CaptchaVerdict {
  const verdict = checkCaptcha(id, answer, now);
  if (!verdict.ok) return verdict;
  challenges.delete(id);
  return verdict;
}

/** Test-only. Not used by the form runtime. */
export function captchaSecretForTests(id: string): string | undefined {
  return challenges.get(id)?.answer;
}

export function resetCaptchaStore() {
  challenges.clear();
}

function isGroup(component: FormComponent): boolean {
  return component.type === "panel" || component.type === "fieldset" || component.type === "tabs" || component.type === "content" || component.type === "button" || component.type === "review";
}

/**
 * After field validation has passed, spend each captcha once and drop the typed
 * characters from the stored submission.
 */
export function settleCaptcha(
  components: FormComponent[],
  data: Record<string, unknown>,
  now = Date.now(),
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const next = structuredClone(data);
  const errors: Record<string, string> = {};
  const pending: { id: string; answer: string; target: Record<string, unknown>; key: string }[] = [];

  const visit = (list: FormComponent[], target: Record<string, unknown>, prefix: string) => {
    for (const component of list) {
      if (component.type === "columns") {
        component.columns?.forEach((col) => visit(col.components, target, prefix));
        continue;
      }
      if (isGroup(component)) {
        visit(component.components ?? [], target, prefix);
        continue;
      }
      if (component.type === "container") {
        const child = target[component.key] && typeof target[component.key] === "object" && !Array.isArray(target[component.key])
          ? { ...(target[component.key] as Record<string, unknown>) }
          : {};
        visit(component.components ?? [], child, prefix ? `${prefix}.${component.key}` : component.key);
        target[component.key] = child;
        continue;
      }
      if (component.type !== "captcha") continue;
      const path = prefix ? `${prefix}.${component.key}` : component.key;
      const parsed = readCaptcha(target[component.key]);
      if (!parsed || !parsed.answer.trim()) {
        errors[path] = "Complete the captcha";
        continue;
      }
      const verdict = checkCaptcha(parsed.id, parsed.answer, now);
      if (!verdict.ok) errors[path] = verdict.message;
      else pending.push({ id: parsed.id, answer: parsed.answer, target, key: component.key });
    }
  };

  visit(components, next, "");
  if (Object.keys(errors).length) return { ok: false, errors };
  for (const item of pending) {
    const spent = consumeCaptcha(item.id, item.answer, now);
    if (!spent.ok) return { ok: false, errors: { [item.key]: spent.message } };
    item.target[item.key] = { id: item.id, passed: true };
  }
  return { ok: true, data: next };
}
