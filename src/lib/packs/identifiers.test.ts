import assert from "node:assert/strict";
import test from "node:test";
import { checkCnpj, checkCpf, checkNit, checkRut, checkWithPack, latamPack, nitCheckDigit, rutCheckChar } from "./identifiers.ts";

test("Colombia NIT and Chile RUT check digits", () => {
  assert.equal(nitCheckDigit("900373678"), 8);
  assert.equal(checkNit("900.373.678-8").ok, true);
  assert.equal(checkNit("900373678-1").ok, false);
  assert.equal(rutCheckChar("12345678"), "5");
  assert.equal(checkRut("12.345.678-5").ok, true);
  assert.equal(checkRut("12025218-K").ok, false);
});

test("CPF and CNPJ reject bad check digits", () => {
  assert.equal(checkCpf("529.982.247-25").ok, true);
  assert.equal(checkCpf("111.111.111-11").ok, false);
  assert.equal(checkCnpj("11.222.333/0001-81").ok, true);
  assert.equal(checkWithPack(latamPack, "br.cpf", "52998224725").normalized, "52998224725");
  assert.equal(checkWithPack(latamPack, "nope", "1").ok, false);
});
