export interface CheckResult {
  ok: boolean;
  normalized?: string;
  message?: string;
}

export interface DomainValidator {
  name: string;
  check(value: string): CheckResult;
}

export interface DomainPack {
  id: string;
  title: string;
  validators: DomainValidator[];
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Colombia NIT check digit, DIAN modulus 11. */
export function nitCheckDigit(body: string): number | null {
  const digits = digitsOnly(body);
  if (!digits || digits.length > 15) return null;
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const weight = weights[index];
    const digit = digits[digits.length - 1 - index];
    if (weight == null || digit == null) return null;
    sum += Number(digit) * weight;
  }
  const mod = sum % 11;
  return mod > 1 ? 11 - mod : mod;
}

export function checkNit(value: string): CheckResult {
  const compact = value.replace(/[\s.]/g, "");
  const match = /^(\d{5,15})-?(\d)$/.exec(compact);
  if (!match?.[1] || !match[2]) return { ok: false, message: "NIT must be a body and a check digit" };
  const expected = nitCheckDigit(match[1]);
  if (expected == null || String(expected) !== match[2]) return { ok: false, message: "NIT check digit does not match" };
  return { ok: true, normalized: `${match[1]}-${match[2]}` };
}

/** Chile RUT. Check character is 0-9 or K. */
export function rutCheckChar(body: string): string | null {
  const digits = digitsOnly(body);
  if (!digits || digits.length < 7 || digits.length > 8) return null;
  let sum = 0;
  let factor = 2;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += Number(digits[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  if (rest === 11) return "0";
  if (rest === 10) return "K";
  return String(rest);
}

export function checkRut(value: string): CheckResult {
  const compact = value.replace(/[.\s]/g, "").toUpperCase();
  const match = /^(\d{7,8})-?([\dK])$/.exec(compact);
  if (!match?.[1] || !match[2]) return { ok: false, message: "RUT must include a body and a check character" };
  const expected = rutCheckChar(match[1]);
  if (expected !== match[2]) return { ok: false, message: "RUT check character does not match" };
  return { ok: true, normalized: `${match[1]}-${match[2]}` };
}

function brCheck(digits: string, length: number): boolean {
  const body = digits.slice(0, length);
  let weight = length + 1;
  let sum = 0;
  for (const char of body) {
    sum += Number(char) * weight;
    weight -= 1;
  }
  const rest = sum % 11;
  const digit = rest < 2 ? 0 : 11 - rest;
  return digit === Number(digits[length]);
}

export function checkCpf(value: string): CheckResult {
  const digits = digitsOnly(value);
  if (digits.length !== 11) return { ok: false, message: "CPF must have 11 digits" };
  if (/^(\d)\1{10}$/.test(digits)) return { ok: false, message: "CPF is a repeated sequence" };
  if (!brCheck(digits, 9) || !brCheck(digits, 10)) return { ok: false, message: "CPF check digits do not match" };
  return { ok: true, normalized: digits };
}

export function checkCnpj(value: string): CheckResult {
  const digits = digitsOnly(value);
  if (digits.length !== 14) return { ok: false, message: "CNPJ must have 14 digits" };
  if (/^(\d)\1{13}$/.test(digits)) return { ok: false, message: "CNPJ is a repeated sequence" };
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, char, index) => total + Number(char) * (weights[index] ?? 0), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[12]) || second !== Number(digits[13])) return { ok: false, message: "CNPJ check digits do not match" };
  return { ok: true, normalized: digits };
}

export const latamPack: DomainPack = {
  id: "latam-identifiers",
  title: "Latin America tax identifiers",
  validators: [
    { name: "co.nit", check: checkNit },
    { name: "cl.rut", check: checkRut },
    { name: "br.cpf", check: checkCpf },
    { name: "br.cnpj", check: checkCnpj },
  ],
};

export function validatorByName(pack: DomainPack, name: string): DomainValidator | undefined {
  return pack.validators.find((item) => item.name === name);
}

export function checkWithPack(pack: DomainPack, name: string, value: string): CheckResult {
  const validator = validatorByName(pack, name);
  if (!validator) return { ok: false, message: `Unknown validator ${name}` };
  return validator.check(value);
}
