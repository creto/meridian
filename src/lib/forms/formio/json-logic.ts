/** Subset of JSON Logic used by Form.io edit forms and component conditionals. No arbitrary code. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function lookup(data: unknown, path: string): unknown {
  if (!path) return data;
  const parts = path.split(".");
  let current = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function looseEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left == right;
  if (typeof left === "number" || typeof right === "number") return Number(left) === Number(right);
  return String(left) === String(right);
}

export function applyJsonLogic(rule: unknown, data: unknown): unknown {
  if (!isRecord(rule)) return rule;
  const entries = Object.entries(rule);
  if (entries.length !== 1) return null;
  const [op, raw] = entries[0]!;
  const args = Array.isArray(raw) ? raw : [raw];
  const value = (item: unknown) => applyJsonLogic(item, data);
  switch (op) {
    case "var": {
      const spec = Array.isArray(raw) ? raw : [raw];
      const path = spec[0] == null ? "" : String(spec[0]);
      const found = lookup(data, path);
      return found === undefined ? spec[1] : found;
    }
    case "===":
      return value(args[0]) === value(args[1]);
    case "!==":
      return value(args[0]) !== value(args[1]);
    case "==":
      return looseEqual(value(args[0]), value(args[1]));
    case "!=":
      return !looseEqual(value(args[0]), value(args[1]));
    case ">":
      return Number(value(args[0])) > Number(value(args[1]));
    case ">=":
      return Number(value(args[0])) >= Number(value(args[1]));
    case "<":
      return Number(value(args[0])) < Number(value(args[1]));
    case "<=":
      return Number(value(args[0])) <= Number(value(args[1]));
    case "!":
      return !value(args[0]);
    case "!!":
      return !!value(args[0]);
    case "and":
      return args.every((item) => value(item));
    case "or":
      return args.some((item) => value(item));
    case "in": {
      const needle = value(args[0]);
      const hay = value(args[1]);
      if (Array.isArray(hay)) return hay.some((item) => item === needle || String(item) === String(needle));
      if (typeof hay === "string") return hay.includes(String(needle ?? ""));
      return false;
    }
    case "if": {
      for (let index = 0; index < args.length - 1; index += 2) {
        if (value(args[index])) return value(args[index + 1]);
      }
      return args.length % 2 === 1 ? value(args[args.length - 1]) : null;
    }
    case "cat":
      return args.map((item) => String(value(item) ?? "")).join("");
    default:
      return null;
  }
}
