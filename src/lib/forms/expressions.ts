export type ExprValue = unknown;

export interface EvalOk {
  ok: true;
  value: ExprValue;
}
export interface EvalErr {
  ok: false;
  error: string;
}

type Ast =
  | { kind: "lit"; value: ExprValue }
  | { kind: "path"; parts: (string | number)[] }
  | { kind: "unary"; op: "not" | "-"; expr: Ast }
  | { kind: "binary"; op: string; left: Ast; right: Ast }
  | { kind: "call"; name: string; args: Ast[] }
  | { kind: "array"; items: Ast[] };

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "sym"; v: string };

const FNS = new Set(["empty", "exists", "len", "IF", "if", "SUM", "AVG", "MIN", "MAX", "COUNT", "round", "abs", "contains", "startsWith", "endsWith"]);

function tokenize(input: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let s = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\") {
          i += 1;
          s += input[i] ?? "";
        } else s += input[i];
        i += 1;
      }
      i += 1;
      tokens.push({ t: "str", v: s });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j += 1;
      tokens.push({ t: "num", v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      tokens.push({ t: "sym", v: two });
      i += 2;
      continue;
    }
    if ("><+-*/(),.[]".includes(ch)) {
      tokens.push({ t: "sym", v: ch });
      i += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j]!)) j += 1;
      tokens.push({ t: "id", v: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character “${ch}”`);
  }
  return tokens;
}

class Parser {
  private i = 0;
  private tokens: Tok[];
  constructor(tokens: Tok[]) {
    this.tokens = tokens;
  }

  parse(): Ast {
    const ast = this.parseOr();
    if (this.i < this.tokens.length) throw new Error(`Unexpected “${this.show()}”`);
    return ast;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i];
  }
  private show(): string {
    const t = this.peek();
    if (!t) return "end";
    return t.t === "id" || t.t === "sym" ? t.v : t.t;
  }
  private eat(): Tok {
    const t = this.tokens[this.i];
    if (!t) throw new Error("Unexpected end of expression");
    this.i += 1;
    return t;
  }
  private isSym(v: string): boolean {
    const t = this.peek();
    return t?.t === "sym" && t.v === v;
  }
  private isId(...names: string[]): boolean {
    const t = this.peek();
    return t?.t === "id" && names.includes(t.v);
  }

  private parseOr(): Ast {
    let left = this.parseAnd();
    while (this.isSym("||") || this.isId("or")) {
      this.eat();
      left = { kind: "binary", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }
  private parseAnd(): Ast {
    let left = this.parseNot();
    while (this.isSym("&&") || this.isId("and")) {
      this.eat();
      left = { kind: "binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }
  private parseNot(): Ast {
    if (this.isId("not") || this.isSym("!")) {
      this.eat();
      return { kind: "unary", op: "not", expr: this.parseNot() };
    }
    return this.parseCmp();
  }
  private parseCmp(): Ast {
    let left = this.parseAdd();
    const cmp = this.peek();
    const op =
      cmp?.t === "sym" && ["==", "!=", ">", ">=", "<", "<="].includes(cmp.v)
        ? cmp.v
        : cmp?.t === "id" && ["in", "contains", "startsWith", "endsWith"].includes(cmp.v)
          ? cmp.v
          : null;
    if (!op) return left;
    this.eat();
    left = { kind: "binary", op, left, right: this.parseAdd() };
    return left;
  }
  private parseAdd(): Ast {
    let left = this.parseMul();
    while (this.isSym("+") || this.isSym("-")) {
      const op = (this.eat() as { v: string }).v;
      left = { kind: "binary", op, left, right: this.parseMul() };
    }
    return left;
  }
  private parseMul(): Ast {
    let left = this.parseUnary();
    while (this.isSym("*") || this.isSym("/")) {
      const op = (this.eat() as { v: string }).v;
      left = { kind: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }
  private parseUnary(): Ast {
    if (this.isSym("-")) {
      this.eat();
      return { kind: "unary", op: "-", expr: this.parseUnary() };
    }
    return this.parsePrimary();
  }
  private parsePrimary(): Ast {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.t === "num") {
      this.eat();
      return { kind: "lit", value: t.v };
    }
    if (t.t === "str") {
      this.eat();
      return { kind: "lit", value: t.v };
    }
    if (this.isSym("(")) {
      this.eat();
      const inner = this.parseOr();
      if (!this.isSym(")")) throw new Error("Missing )");
      this.eat();
      return this.parsePostfix(inner);
    }
    if (this.isSym("[")) {
      this.eat();
      const items: Ast[] = [];
      if (!this.isSym("]")) {
        items.push(this.parseOr());
        while (this.isSym(",")) {
          this.eat();
          items.push(this.parseOr());
        }
      }
      if (!this.isSym("]")) throw new Error("Missing ]");
      this.eat();
      return { kind: "array", items };
    }
    if (t.t === "id") {
      this.eat();
      if (t.v === "true") return { kind: "lit", value: true };
      if (t.v === "false") return { kind: "lit", value: false };
      if (t.v === "null") return { kind: "lit", value: null };
      if (this.isSym("(")) {
        if (!FNS.has(t.v) && !["empty", "exists"].includes(t.v)) {
          throw new Error(`Unknown function ${t.v}`);
        }
        this.eat();
        const args: Ast[] = [];
        if (!this.isSym(")")) {
          args.push(this.parseOr());
          while (this.isSym(",")) {
            this.eat();
            args.push(this.parseOr());
          }
        }
        if (!this.isSym(")")) throw new Error("Missing )");
        this.eat();
        return { kind: "call", name: t.v, args };
      }
      const path: (string | number)[] = [t.v];
      return this.parsePostfix({ kind: "path", parts: path });
    }
    throw new Error(`Unexpected “${this.show()}”`);
  }
  private parsePostfix(ast: Ast): Ast {
    let current = ast;
    while (this.isSym(".") || this.isSym("[")) {
      if (current.kind !== "path") throw new Error("Invalid member access");
      if (this.isSym(".")) {
        this.eat();
        const id = this.eat();
        if (id.t !== "id") throw new Error("Expected name after .");
        current = { kind: "path", parts: [...current.parts, id.v] };
      } else {
        this.eat();
        const inner = this.eat();
        let key: string | number;
        if (inner.t === "str") key = inner.v;
        else if (inner.t === "num") key = inner.v;
        else if (inner.t === "id") key = inner.v;
        else throw new Error("Invalid index");
        if (!this.isSym("]")) throw new Error("Missing ]");
        this.eat();
        current = { kind: "path", parts: [...current.parts, key] };
      }
    }
    return current;
  }
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number" && Number.isNaN(value)) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

function truthy(value: unknown): boolean {
  return !isEmpty(value) && value !== false && value !== 0;
}

function lookup(scope: Record<string, unknown>, parts: (string | number)[]): unknown {
  const [head, ...rest] = parts;
  if (head == null) return undefined;
  let current: unknown;
  if (Object.prototype.hasOwnProperty.call(scope, String(head))) current = scope[String(head)];
  else if (scope.data && typeof scope.data === "object" && scope.data !== null && Object.prototype.hasOwnProperty.call(scope.data, String(head))) {
    current = (scope.data as Record<string, unknown>)[String(head)];
  } else current = undefined;
  for (const part of rest) {
    if (current == null) return undefined;
    if (Array.isArray(current) && typeof part === "number") current = current[part];
    else if (typeof current === "object") current = (current as Record<string, unknown>)[String(part)];
    else return undefined;
  }
  return current;
}

function evalAst(ast: Ast, scope: Record<string, unknown>): unknown {
  switch (ast.kind) {
    case "lit":
      return ast.value;
    case "path":
      return lookup(scope, ast.parts);
    case "array":
      return ast.items.map((item) => evalAst(item, scope));
    case "unary": {
      const v = evalAst(ast.expr, scope);
      if (ast.op === "not") return !truthy(v);
      const n = asNumber(v);
      return n == null ? null : -n;
    }
    case "binary": {
      if (ast.op === "and") return truthy(evalAst(ast.left, scope)) && truthy(evalAst(ast.right, scope));
      if (ast.op === "or") return truthy(evalAst(ast.left, scope)) || truthy(evalAst(ast.right, scope));
      const left = evalAst(ast.left, scope);
      const right = evalAst(ast.right, scope);
      if (ast.op === "==") return left === right || (asNumber(left) != null && asNumber(left) === asNumber(right) && typeof left !== "boolean" && typeof right !== "boolean" && String(left) !== "" && String(right) !== "");
      if (ast.op === "!=") return !(left === right || (asNumber(left) != null && asNumber(left) === asNumber(right) && typeof left !== "boolean"));
      if (ast.op === "contains") return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
      if (ast.op === "startsWith") return String(left ?? "").toLowerCase().startsWith(String(right ?? "").toLowerCase());
      if (ast.op === "endsWith") return String(left ?? "").toLowerCase().endsWith(String(right ?? "").toLowerCase());
      if (ast.op === "in") {
        if (Array.isArray(right)) return right.map(String).includes(String(left));
        return String(right ?? "").toLowerCase().includes(String(left ?? "").toLowerCase());
      }
      const ln = asNumber(left);
      const rn = asNumber(right);
      if (ln == null || rn == null) return ast.op === "+" ? `${left ?? ""}${right ?? ""}` : null;
      if (ast.op === ">") return ln > rn;
      if (ast.op === ">=") return ln >= rn;
      if (ast.op === "<") return ln < rn;
      if (ast.op === "<=") return ln <= rn;
      if (ast.op === "+") return ln + rn;
      if (ast.op === "-") return ln - rn;
      if (ast.op === "*") return ln * rn;
      if (ast.op === "/") return rn === 0 ? null : ln / rn;
      return null;
    }
    case "call":
      return evalCall(ast.name, ast.args, scope);
  }
}

function rowNumber(row: unknown, key: string): number {
  if (!row || typeof row !== "object") return 0;
  return asNumber((row as Record<string, unknown>)[key]) ?? 0;
}

function evalCall(name: string, args: Ast[], scope: Record<string, unknown>): unknown {
  const values = args.map((a) => evalAst(a, scope));
  if (name === "empty") return isEmpty(values[0]);
  if (name === "exists") return !isEmpty(values[0]);
  if (name === "len") {
    const v = values[0];
    if (typeof v === "string" || Array.isArray(v)) return v.length;
    return 0;
  }
  if (name === "abs") {
    const n = asNumber(values[0]);
    return n == null ? null : Math.abs(n);
  }
  if (name === "round") {
    const n = asNumber(values[0]);
    const d = asNumber(values[1]) ?? 0;
    if (n == null) return null;
    const f = 10 ** d;
    return Math.round(n * f) / f;
  }
  if (name === "IF" || name === "if") return truthy(values[0]) ? values[1] : values[2];
  if (name === "contains") return String(values[0] ?? "").toLowerCase().includes(String(values[1] ?? "").toLowerCase());
  if (name === "startsWith") return String(values[0] ?? "").toLowerCase().startsWith(String(values[1] ?? "").toLowerCase());
  if (name === "endsWith") return String(values[0] ?? "").toLowerCase().endsWith(String(values[1] ?? "").toLowerCase());
  const reduceKey = (fn: (nums: number[]) => number): number | null => {
    if (values.length === 1 && typeof values[0] === "string" && Array.isArray(scope.rows)) {
      const nums = (scope.rows as unknown[]).map((row) => rowNumber(row, String(values[0])));
      return fn(nums);
    }
    if (values.length >= 1 && Array.isArray(values[0]) && typeof values[1] === "string") {
      const nums = (values[0] as unknown[]).map((row) => rowNumber(row, String(values[1])));
      return fn(nums);
    }
    if (values.length === 1 && Array.isArray(values[0])) {
      const nums = (values[0] as unknown[]).map((n) => asNumber(n) ?? 0);
      return fn(nums);
    }
    return fn(values.map((v) => asNumber(v) ?? 0));
  };
  if (name === "SUM") return reduceKey((nums) => nums.reduce((a, b) => a + b, 0));
  if (name === "AVG") return reduceKey((nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0));
  if (name === "MIN") return reduceKey((nums) => (nums.length ? Math.min(...nums) : 0));
  if (name === "MAX") return reduceKey((nums) => (nums.length ? Math.max(...nums) : 0));
  if (name === "COUNT") {
    if (values.length === 1 && Array.isArray(values[0])) return values[0].length;
    if (typeof values[0] === "string" && Array.isArray(scope.rows)) return (scope.rows as unknown[]).length;
    return values.length;
  }
  throw new Error(`Unknown function ${name}`);
}

export function compileExpression(input: string): { ok: true; ast: Ast } | EvalErr {
  try {
    if (!input.trim()) return { ok: false, error: "Expression is empty" };
    if (input.length > 4_000) return { ok: false, error: "Expression is too long" };
    const tokens = tokenize(input);
    if (tokens.length > 400) return { ok: false, error: "Expression is too complex" };
    const ast = new Parser(tokens).parse();
    return { ok: true, ast };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid expression" };
  }
}

export function evaluate(input: string, scope: Record<string, unknown>): EvalOk | EvalErr {
  const compiled = compileExpression(input);
  if (!compiled.ok) return compiled;
  try {
    return { ok: true, value: evalAst(compiled.ast, scope) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Evaluation failed" };
  }
}

export function evalBool(input: string | undefined, scope: Record<string, unknown>, whenMissing = true): boolean {
  if (!input || !input.trim()) return whenMissing;
  const result = evaluate(input, scope);
  if (!result.ok) return false;
  return truthy(result.value);
}

export function referencedKeys(input: string): string[] {
  const compiled = compileExpression(input);
  if (!compiled.ok) return [];
  const keys = new Set<string>();
  const walk = (ast: Ast) => {
    if (ast.kind === "path" && typeof ast.parts[0] === "string") {
      const head = ast.parts[0];
      if (!["data", "row", "rows", "value", "true", "false", "null"].includes(head)) keys.add(head);
      if (head === "data" && typeof ast.parts[1] === "string") keys.add(ast.parts[1]);
      if (head === "row" && typeof ast.parts[1] === "string") keys.add(ast.parts[1]);
    }
    if (ast.kind === "unary") walk(ast.expr);
    if (ast.kind === "binary") {
      walk(ast.left);
      walk(ast.right);
    }
    if (ast.kind === "call") ast.args.forEach(walk);
    if (ast.kind === "array") ast.items.forEach(walk);
  };
  walk(compiled.ast);
  return [...keys];
}

export { isEmpty, truthy, asNumber };
