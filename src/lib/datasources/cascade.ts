import { blockedDestination } from "../security/ssrf.ts";

export type SourceKind = "static" | "rest" | "catalog" | "form" | "submission" | "json" | "csv";

export interface LookupItem {
  label: string;
  value: string;
}

export interface SecretRef {
  secret: string;
}

export interface LookupConfig {
  kind: SourceKind;
  method?: string;
  url?: string;
  query?: Record<string, string>;
  headers?: Record<string, string | SecretRef>;
  resultPath?: string;
  labelPath?: string;
  valuePath?: string;
  cacheTtlMs?: number;
  dependsOn?: string;
  staticItems?: LookupItem[];
  csv?: string;
  catalog?: Record<string, LookupItem[]>;
}

export interface LookupDeps {
  fetch: (url: string, init: { method: string; headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; body: unknown }>;
  now: () => number;
  cache: Map<string, { expires: number; items: LookupItem[] }>;
  secrets: Record<string, string>;
}

export function dotPath(value: unknown, path: string | undefined): unknown {
  if (!path) return value;
  let current = value;
  for (const part of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function parseCsvCatalog(csv: string): LookupItem[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.slice(1).map((line) => {
    const [value, label] = line.split(",");
    return { value: (value ?? "").trim(), label: (label ?? value ?? "").trim() };
  }).filter((item) => item.value);
}

function asItems(value: unknown, labelPath: string, valuePath: string): LookupItem[] {
  const list = Array.isArray(value) ? value : [];
  return list.map((row) => {
    if (typeof row === "string") return { label: row, value: row };
    const record = row as Record<string, unknown>;
    const itemValue = String(dotPath(record, valuePath) ?? "");
    const label = String(dotPath(record, labelPath) ?? itemValue);
    return { label, value: itemValue };
  }).filter((item) => item.value);
}

function resolveHeaders(headers: LookupConfig["headers"], secrets: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === "string") out[key] = value;
    else {
      const secret = secrets[value.secret];
      if (!secret) throw new Error(`Missing secret ${value.secret}`);
      out[key] = secret;
    }
  }
  return out;
}

export async function resolveLookup(config: LookupConfig, parentValue: string | undefined, deps: LookupDeps): Promise<LookupItem[]> {
  if (config.kind === "static") return config.staticItems ?? [];
  if (config.kind === "csv") return parseCsvCatalog(config.csv ?? "");
  if (config.kind === "catalog" || config.kind === "form" || config.kind === "submission") {
    const table = config.catalog ?? {};
    if (config.dependsOn) return table[parentValue ?? ""] ?? [];
    return Object.values(table).flat();
  }
  if (!config.url) return [];
  const blocked = blockedDestination(config.url);
  if (blocked) throw new Error(blocked);
  const url = new URL(config.url);
  for (const [key, value] of Object.entries(config.query ?? {})) {
    url.searchParams.set(key, value === "$parent" ? parentValue ?? "" : value);
  }
  const cacheKey = `${config.kind}:${url.toString()}`;
  const hit = deps.cache.get(cacheKey);
  if (hit && hit.expires > deps.now()) return hit.items;
  const response = await deps.fetch(url.toString(), { method: config.method ?? "GET", headers: resolveHeaders(config.headers, deps.secrets) });
  if (!response.ok) throw new Error(`Lookup failed with ${response.status}`);
  const list = config.resultPath ? dotPath(response.body, config.resultPath) : response.body;
  const items = asItems(list, config.labelPath ?? "label", config.valuePath ?? "value");
  if ((config.cacheTtlMs ?? 0) > 0) deps.cache.set(cacheKey, { expires: deps.now() + (config.cacheTtlMs ?? 0), items });
  return items;
}

export class LookupClient {
  private generation = 0;
  private current = new Map<string, LookupItem[]>();

  async resolve(key: string, loader: (generation: number) => Promise<{ generation: number; items: LookupItem[] }>): Promise<LookupItem[] | null> {
    const generation = ++this.generation;
    const result = await loader(generation);
    if (result.generation !== this.generation) return null;
    this.current.set(key, result.items);
    return result.items;
  }

  snapshot(key: string): LookupItem[] {
    return this.current.get(key) ?? [];
  }
}

export interface Clock {
  now: number;
  waiters: Array<{ at: number; fn: () => void }>;
}

export function createDebouncedValidator(fn: (value: string) => Promise<string | null>, waitMs: number, clock: Clock) {
  let ticket = 0;
  return (value: string): Promise<string | null> => new Promise((resolve) => {
    const mine = ++ticket;
    clock.waiters.push({
      at: clock.now + waitMs,
      fn: () => {
        if (mine !== ticket) {
          resolve(null);
          return;
        }
        void fn(value).then(resolve);
      },
    });
  });
}

export function flushClock(clock: Clock, until: number): void {
  clock.now = until;
  const due = clock.waiters.filter((waiter) => waiter.at <= until);
  clock.waiters = clock.waiters.filter((waiter) => waiter.at > until);
  for (const waiter of due) waiter.fn();
}
