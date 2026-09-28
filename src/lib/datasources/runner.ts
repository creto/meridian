import { resolveLookup, type LookupConfig, type LookupDeps, type LookupItem } from "./cascade.ts";

export interface CascadeLevel {
  key: string;
  config: LookupConfig;
}

export interface CascadeResult {
  values: Record<string, string>;
  options: Record<string, LookupItem[]>;
  staleDropped: number;
}

/**
 * Country, then department, then city.
 * A slower response for an older parent value is dropped.
 */
export async function runCascade(
  levels: CascadeLevel[],
  selection: Record<string, string>,
  deps: LookupDeps,
): Promise<CascadeResult> {
  const options: Record<string, LookupItem[]> = {};
  const values: Record<string, string> = {};
  let staleDropped = 0;
  let generation = 0;
  const latest = new Map<string, number>();
  for (const level of levels) {
    const parentKey = level.config.dependsOn;
    const parent = parentKey ? values[parentKey] : undefined;
    if (parentKey && !parent) {
      options[level.key] = [];
      continue;
    }
    generation += 1;
    const ticket = generation;
    latest.set(level.key, ticket);
    const items = await resolveLookup(level.config, parent, deps);
    if (latest.get(level.key) !== ticket) {
      staleDropped += 1;
      continue;
    }
    options[level.key] = items;
    const chosen = selection[level.key];
    if (chosen && items.some((item) => item.value === chosen)) values[level.key] = chosen;
  }
  return { values, options, staleDropped };
}

export function countryDepartmentCity(input: {
  countries: LookupItem[];
  departments: Record<string, LookupItem[]>;
  cities: Record<string, LookupItem[]>;
}): CascadeLevel[] {
  return [
    { key: "country", config: { kind: "static", staticItems: input.countries } },
    { key: "department", config: { kind: "catalog", catalog: input.departments, dependsOn: "country" } },
    { key: "city", config: { kind: "catalog", catalog: input.cities, dependsOn: "department" } },
  ];
}

export interface AsyncRule {
  key: string;
  check: (value: string) => Promise<string | null>;
}

export interface DebounceClock {
  now: () => number;
  wait: (ms: number) => Promise<void>;
}

/**
 * Client debounce. Only the latest call for a field is allowed to publish an error.
 * The server check is still the authority; this only avoids painting a stale error.
 */
export function createAsyncValidator(clock: DebounceClock, delayMs: number) {
  const generation = new Map<string, number>();
  return async function validate(rule: AsyncRule, value: string): Promise<{ generation: number; error: string | null; ignored: boolean }> {
    const next = (generation.get(rule.key) ?? 0) + 1;
    generation.set(rule.key, next);
    await clock.wait(delayMs);
    if (generation.get(rule.key) !== next) return { generation: next, error: null, ignored: true };
    const error = await rule.check(value);
    if (generation.get(rule.key) !== next) return { generation: next, error: null, ignored: true };
    return { generation: next, error, ignored: false };
  };
}

export function validateDataSource(config: LookupConfig): string[] {
  const errors: string[] = [];
  if (config.kind === "rest" || config.kind === "json") {
    if (!config.url) errors.push("URL is required");
    if (config.method && !["GET", "POST"].includes(config.method.toUpperCase())) errors.push("Method must be GET or POST");
  }
  if (config.kind === "csv" && !config.csv) errors.push("CSV is required");
  if (config.kind === "static" && !config.staticItems?.length) errors.push("Static items are required");
  if ((config.cacheTtlMs ?? 0) < 0) errors.push("Cache TTL cannot be negative");
  return errors;
}
