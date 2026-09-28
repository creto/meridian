# Final completion scorecard

This is not a claim that every acceptance gate passed. Evidence is a test name or a file. "Known limitation" is the reason it is not COMPLETE.

| Requirement | Status | Evidence | Known limitation |
| --- | --- | --- | --- |
| PostgreSQL system of record | PARTIAL | `migrations/0001_meridian_platform.sql`, `src/lib/db.ts` data dir, platform restart test | Interactive preview still caches in the browser and syncs. There is no hosted Postgres in this sandbox unless `DATABASE_URL` is set. |
| Multi-tenant isolation | PARTIAL | `seedPlatform`, restart test loads Northwind and Contoso separately | UI has one workspace. Isolation is enforced in repository queries used by the new API, not on every old store action. |
| Local login | PARTIAL | `login` scrypt + session row, test rejects a bad password | Preview is not behind a login wall, so a refresh does not ask for Ada's password. |
| API keys hashed, scoped, revocable | COMPLETE | `createApiKey`, `authenticateApiKey`, `revokeApiKey` test | IP allow-lists are not stored. |
| Encrypted secrets | COMPLETE | AES-256-GCM in `crypto.ts`, round trip in the platform test | Master key is `MERIDIAN_MASTER_KEY` or `data/master.key`, not a cloud KMS. |
| Durable forms and submissions | PARTIAL | `workspace_state` payload, reopen test | Normalized per-field columns are not split out of the JSON document. |
| Timer executes and survives restart | PARTIAL | `advanceServices` timer-fired test, `waitUntil` stored on the submission inside `workspace_state` | A due timer resumes on the next agent sync, not on a dedicated clock process. |
| Parallel split and join | COMPLETE | gateway test: one approval does not finish, the second joins to `end` | The flow canvas is still a list, not a pan/zoom editor. |
| Job queue | PARTIAL | `claimDueJobs` uses `FOR UPDATE SKIP LOCKED` | Not Redis/BullMQ. No SSE progress stream. |
| Webhook retry and dead letter | PARTIAL | 7 failures mark `dead`; success marks `delivered` | The HTTP sender is still request-triggered, not a surviving worker loop. |
| Tamper-evident audit | PARTIAL | `verifyAuditChain` | Chain is per tenant in Postgres. It is not an external ledger. |
| GCS beyond upload-only | PARTIAL | `mintGcsAssertion` verifies; `getGcs` / `deleteGcs` / `testGcs` | Live Google calls fail closed without a service account. |
| SSRF guard | COMPLETE | `blockedTarget` test | DNS rebinding after the check is not re-resolved. |
| Health | COMPLETE | `/health/live`, `/health/ready`, and `/api/agent/v1/health/*` | Ready means the platform bootstrap promise resolved, not a replica quorum. |
| MCP runtime | PARTIAL | `handleMcpMessage` test | No long-running stdio supervisor shipped as a package. |
| Angular SDK | DEFERRED_WITH_REASON | — | This product is the TanStack app. An Angular package that does not build here would be a false SDK. |
| AcroForm / flatten | DEFERRED_WITH_REASON | percent placement still in `pdf.ts` | No AcroForm library is vendored. A fake detector would violate the completion rules. |
| OpenTelemetry export | DEFERRED_WITH_REASON | — | No collector is configured. A local console logger would not be traces. |
| Helm / Kubernetes | DEFERRED_WITH_REASON | — | This sandbox is a single Node process. Charts would not be exercised. |
| Redis | DEFERRED_WITH_REASON | Postgres job table is the queue that actually runs | Adding BullMQ without a Redis the tests can claim would be a second, unused queue. |
