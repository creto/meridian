import assert from "node:assert/strict";
import { test } from "node:test";
import { captchaSecretForTests, checkCaptcha, consumeCaptcha, issueCaptcha, resetCaptchaStore, settleCaptcha } from "./captcha.ts";
import { validateForm } from "./engine.ts";
import type { FormDefinition } from "./types.ts";

function formWithCaptcha(): FormDefinition {
  return {
    id: "frm_captcha",
    name: "captcha",
    title: "Captcha",
    version: 1,
    status: "draft",
    display: "form",
    components: [{ id: "cap", type: "captcha", key: "human", label: "Captcha", required: true }],
    tags: [],
    pdfPages: 1,
    settings: { successMessage: "Saved", allowDrafts: true },
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as FormDefinition;
}

test("a captcha accepts the issued characters once and rejects the rest", () => {
  resetCaptchaStore();
  const challenge = issueCaptcha();
  const answer = captchaSecretForTests(challenge.id);
  assert.equal(answer?.length, 5);
  assert.equal(challenge.glyphs.map((glyph) => glyph.text).join(""), answer);
  assert.equal(checkCaptcha(challenge.id, answer!.toLowerCase()).ok, true);
  assert.equal(checkCaptcha(challenge.id, "WRONG").ok, false);
  assert.equal(consumeCaptcha(challenge.id, answer!).ok, true);
  assert.equal(consumeCaptcha(challenge.id, answer!).ok, false);
});

test("an expired captcha cannot be solved", () => {
  resetCaptchaStore();
  const challenge = issueCaptcha(0, 1_000);
  const answer = captchaSecretForTests(challenge.id)!;
  const verdict = checkCaptcha(challenge.id, answer, 1_000);
  assert.equal(verdict.ok, false);
  assert.match(verdict.message, /expired/i);
});

test("validateForm and settle keep the pass bit and drop the typed characters", () => {
  resetCaptchaStore();
  const challenge = issueCaptcha();
  const answer = captchaSecretForTests(challenge.id)!;
  const form = formWithCaptcha();
  assert.equal(validateForm(form, {}).human, "Complete the captcha");
  assert.match(validateForm(form, { human: { id: challenge.id, answer: "NOPE" } }).human, /do not match/);
  assert.equal(validateForm(form, { human: { id: challenge.id, answer } }).human, undefined);
  const settled = settleCaptcha(form.components, { human: { id: challenge.id, answer } });
  assert.equal(settled.ok, true);
  if (!settled.ok) return;
  assert.deepEqual(settled.data.human, { id: challenge.id, passed: true });
  assert.equal(JSON.stringify(settled.data).includes(answer), false);
});
