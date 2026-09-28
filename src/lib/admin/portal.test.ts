import assert from "node:assert/strict";
import test from "node:test";
import { cancelJob, cloneRole, createUser, effectivePermissions, filterJobs, maskConnection, retryJob, revokeSessions, searchUsers, seedAdmin, setDisabled, verifyRows } from "./portal.ts";

test("admin directory pages search, disable, and revoke without leaking secrets", () => {
  let snapshot = seedAdmin();
  snapshot = createUser(snapshot, { email: "cia@northwind.example", name: "Cia" });
  const page = searchUsers(snapshot, "cia", null, 10);
  assert.equal(page.users[0]?.email, "cia@northwind.example");
  snapshot = setDisabled(snapshot, "user_ada", true);
  assert.equal(snapshot.users[0]?.sessions.length, 0);
  snapshot = revokeSessions(seedAdmin(), "user_ada");
  assert.deepEqual(snapshot.users[0]?.sessions, []);
  snapshot = cloneRole(seedAdmin(), "role_reviewer", "counsel");
  assert.ok(snapshot.roles.some((role) => role.name === "counsel"));
  assert.deepEqual(effectivePermissions(seedAdmin(), "user_ada"), ["admin.users", "form.publish", "workflow.task.complete"]);
  const masked = maskConnection(seedAdmin().connections[0]!);
  assert.equal(masked.secretName.startsWith("secret:"), true);
  assert.equal("secret" in masked && masked.secret == null, true);
});

test("jobs retry only dead rows and the audit chain notices a broken prev hash", () => {
  let snapshot = seedAdmin();
  snapshot = retryJob(snapshot, "job_2");
  assert.equal(snapshot.jobs.find((job) => job.id === "job_2")?.status, "queued");
  snapshot = cancelJob(snapshot, "job_1");
  assert.equal(filterJobs(snapshot, { status: "cancelled" }).length, 1);
  const broken = verifyRows([...seedAdmin().audit, { seq: 2, actor: "ada", action: "export", target: "audit", at: "2026-09-02T00:00:00.000Z", prev: "nope", hash: "bbb" }]);
  assert.equal(broken.ok, false);
});
