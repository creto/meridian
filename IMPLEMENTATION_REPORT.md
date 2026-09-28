# Implementation report

## Architecture

Meridian is a TanStack Start app. The form engine, builder, supplier template, and storage clients were left in place. This pass added a Postgres schema and moved workspace JSON, users, sessions, API keys, secrets, jobs, webhook deliveries, and audit onto that schema.

Without `DATABASE_URL`, PGLite opens `data/pglite` and applies `migrations/*.sql`. With `DATABASE_URL`, `scripts/migrate.mjs` applies the same files. `data/` is gitignored and holds the database and the local AES master key.

## What is durable

A platform test writes a Northwind submission, closes PGLite, opens the same directory, and reads it back. Contoso's workspace is a different row. An API key minted for Northwind cannot be revoked by Contoso. Passwords are scrypt. API secrets are SHA-256. Secrets are AES-256-GCM. Audit rows hash the previous row. Jobs are claimed with `FOR UPDATE SKIP LOCKED`. Webhook failures follow 1m, 5m, 15m, 1h, 6h, 24h and then `dead`.

The browser still keeps a cache (`meridian-studio-v1`) and posts it to `/api/agent/v1/sync`. If the server revision is newer, the cache is replaced. That is the restart path for the preview.

## Workflow

Timer nodes schedule `waitUntil` and continue only when that time has passed. The agent sync path resumes due timers. Parallel nodes create one token per outgoing edge. A join with the default `all` policy continues only after every branch arrives. The supplier approval path has no tokens and still uses a single approve/reject edge.

## Not done, and not claimed

Angular SDK, Helm, OpenTelemetry export, AcroForm fill/flatten, a Redis deployment, and a login wall on the preview. Details and reasons are in `docs/audit/FINAL_COMPLETION_SCORECARD.md`.

## Tests

`src/lib/platform/platform.test.ts` covers tenant isolation, restart, API keys, secrets, audit, jobs, webhooks, timers, parallel join, the GCS JWT, SSRF, and MCP JSON-RPC. Existing engine and storage tests still pass. `tsc --noEmit` passed after this pass.
