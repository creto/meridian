# Final gap analysis

Compared the original enterprise specification, the repository as it runs, and the status table in the completion prompt. Statuses describe runtime behavior that was executed or inspected, not file names.

Legend: COMPLETE, PARTIAL, MISSING, BROKEN, PLACEHOLDER, DEFERRED_WITH_REASON.

## What changed in this pass

PostgreSQL is now the durable store for the northwind workspace. With no `DATABASE_URL`, the server uses PGLite on disk at `data/pglite` (real Postgres, restart-safe in this workspace). `DATABASE_URL` still uses node-postgres. Tables live in `migrations/0001_meridian_platform.sql`.

Also implemented and tested: two seeded tenants, scrypt passwords, sessions, hashed API keys (`mdn_live_<hex>_<secret>`), AES-256-GCM secrets, SHA-256 audit chain, job claim with `FOR UPDATE SKIP LOCKED`, webhook retry then dead-letter, timer execution, parallel split and all-join, GCS service-account JWT minting, SSRF blocking on generic REST, `/health/live` and `/health/ready`, and an MCP JSON-RPC handler.

The browser store is a cache. It syncs to `/api/agent/v1/sync`. A newer server revision replaces the cache.

## Still not production-complete

Angular SDK, Helm, a Redis/BullMQ deployment, OpenTelemetry export, AcroForm import/flatten, headless-Chromium HTML PDF, malware scanning, and a forced login wall are not done. Reasons are in the scorecard. None of those are marked complete.

## Category status

| Area | Status | Missing behavior |
| --- | --- | --- |
| Form engine | PARTIAL | Legacy JS remains stored and unexecuted. No LEGACY_ISOLATED worker. Nested/i18n/a11y gaps remain. |
| Builder | PARTIAL | Drag, undo, JSON, versions, and diff work. No cross-page paste conflict UI. |
| Templates | COMPLETE | Supplier, incident, purchase, employee, survey, support. |
| Fill / inbox | PARTIAL | Wizard, drafts, review, approve/reject work. Inbox assignment is still the single current node, not a task table. |
| PDF | PARTIAL | Bytes, hash, percent placement. No uploaded template, AcroForm, or flatten. |
| Import | PARTIAL | CSV, xlsx, JSON, JSON Schema, Form.io. No worker for huge files and no mapping UI beyond the sheet picker. |
| Grid | PARTIAL | Edit, sort, filter, formulas, and a 40-row window. Not a virtualized 10k-row grid. |
| Storage clients | PARTIAL | Local, S3, Azure, SharePoint, CMIS, REST. GCS can mint a service-account JWT and get/delete, but a live Google round trip needs credentials. |
| Workflow | PARTIAL | Timer, parallel, and all-join execute and are tested. ANY and N-of-M are in the join function. No visual pan/zoom editor. |
| Agent / SDK | PARTIAL | HTTP agent API, TypeScript client, MCP `tools/list` and `tools/call` handler. No stdio process wired to a live tenant session, no Angular SDK. |
| AI | PARTIAL | Grok when `XAI_API_KEY` is set, otherwise the local designer. No second vendor round trip. |
| RBAC | PARTIAL | Workspace roles on mutations, plus backend users and API-key scopes. The preview does not require login, so the UI is not a full identity wall. |
| Webhooks / audit | PARTIAL | Durable delivery rows, backoff, dead-letter, hash chain. Delivery HTTP is still the existing `/api/hooks/deliver` path, not a worker loop. |
| Identity / Postgres / jobs | PARTIAL | Postgres, users, sessions, API keys, and a Postgres job table exist and survive a PGLite reopen. No Redis, no OIDC provider, no second deployed tenant directory in the UI. |

## Persistence gap that was closed

Before this pass, `src/lib/platform/snapshot.ts` was an in-memory object and PGLite was `memory://` in practice (no data directory). A process restart dropped forms, submissions, secrets, and webhook state. Workspace JSON, secrets, audit, jobs, and idempotency keys now have tables. Tests reopen the data directory and read the same submission.

## Intentionally not faked

- GCS `testGcs` still calls Google. No token, no success.
- Timer nodes do not pretend to fire before `waitUntil`.
- API key secrets are returned once and only the SHA-256 is stored.
- Tenant B cannot revoke Tenant A's key (tested).
- Private REST hosts are rejected unless `allowPrivate` is set.
