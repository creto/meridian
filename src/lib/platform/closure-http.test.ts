import assert from "node:assert/strict";
import test from "node:test";
import { handlePlatform } from "./closure-http.ts";

test("platform routes enforce publication, prefill, stale edits, and exports", async () => {
  const early = await handlePlatform({
    method: "POST",
    path: "publication/check",
    now: "2026-01-01T00:00:00.000Z",
    body: { policy: { mode: "AUTHENTICATED", startAt: "2026-02-01T00:00:00.000Z", submissionsSoFar: 0, oneSubmissionPerToken: false, usedTokens: [], allowedEmbedDomains: [], allowedOrigins: [], hasSession: true, viaApi: false } },
  });
  assert.equal((await early.json()).code, "TOO_EARLY");

  const signed = await handlePlatform({
    method: "POST",
    path: "prefill/sign",
    secret: "s",
    now: "2026-01-01T00:00:00.000Z",
    body: { claims: { tenantId: "ten", formId: "frm", exp: Date.parse("2026-02-01T00:00:00.000Z"), fields: { department: "legal" }, protectedFields: ["department"] } },
  });
  const token = (await signed.json()).token as string;
  const merged = await handlePlatform({
    method: "POST",
    path: "prefill/merge",
    secret: "s",
    now: "2026-01-15T00:00:00.000Z",
    body: { token, query: { department: "evil", note: "ok" } },
  });
  const data = await merged.json();
  assert.equal(data.data.department, "legal");
  assert.deepEqual(data.rejectedKeys, ["department"]);

  const stale = await handlePlatform({ method: "POST", path: "revisions", body: { baseRevision: 1, currentRevision: 2, next: { a: 1 } } });
  assert.equal(stale.status, 409);
  const comment = await handlePlatform({ method: "POST", path: "comments", body: { targetType: "submission", targetId: "sub", authorId: "ada", body: "Looks good" } });
  assert.equal(comment.status, 201);
  const job = await handlePlatform({ method: "POST", path: "exports", body: { filter: { tenantId: "ten" }, includeAttachments: true } });
  assert.equal(job.status, 202);
  const matrix = await handlePlatform({ method: "GET", path: "connectors" });
  assert.ok((await matrix.json()).connectors.length > 50);
});
