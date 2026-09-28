# Deep architecture gap analysis

Inspected from the current Meridian source. Status is what the code does after the relational workspace projection, not what the productionization prompt asks for.

Legend: COMPLETE, PARTIAL, NOT IMPLEMENTED, DEFERRED.

## System of record

| Item | Status | Evidence |
| --- | --- | --- |
| Browser workspace as the editor cache | PARTIAL | Zustand still edits forms in the browser. That is the working copy, not the record. |
| Whole-workspace JSON blob | PARTIAL | `workspace_state.payload` is still written, as an export cache, inside the same transaction as the relational rows. |
| Relational forms, versions, submissions, revisions, workflow instances, outbox | PARTIAL | `migrations/0002_domain.sql` and `replaceTenantWorkspace`. One tenant cannot read another's rows. The query is keyed by a server constant, not a client-supplied tenant. |
| Restart survival | PARTIAL | Deployed Postgres keeps the rows. The preview database is a file under `data/pglite` and survives a process restart on this machine. It is not a managed production cluster. |
| Transactions for publish and submit as their own use cases | NOT IMPLEMENTED | Publish and submit still mutate the workspace, then the whole workspace is projected. There is no lock around a single task completion. |

## Identity, tenancy, authorization

| Item | Status |
| --- | --- |
| Tenant, user, session, API key, secret, job, webhook, audit tables | PARTIAL. Present since `0001_meridian_platform.sql`. Passwords are scrypt, not Argon2id. API secrets are SHA-256. |
| Sign-in that gates the product | DEFERRED. Turning on the platform sign-in would hide the current builder behind a login the screens are not built for. Domain tables do not invent a second login. |
| RBAC beyond `can` / `grantsFor` | NOT IMPLEMENTED. Those helpers are still an in-memory map. They are not consulted by the agent HTTP handler. |
| Cross-tenant tests | PARTIAL. `workspace-store.test.ts` checks form and submission isolation for two tenants. It does not cover API keys, MCP, or tasks. |

## Engines that stayed

| Item | Status |
| --- | --- |
| Safe expression parser | COMPLETE. Expressions longer than 4,000 characters or 400 tokens are rejected. |
| Calculations | PARTIAL. Acyclic fields run in dependency order, including inside a grid. Cycles are detected and not looped. There is no compiled-form cache per version. |
| Form.io import | PARTIAL. Unknown types become text. Dropped configuration is not classified. |
| PDF | PARTIAL. `buildPdf` writes a stacked report and a SHA-256. No uploaded template, no AcroForm, no flatten. |
| Workflow timer, parallel, join | PARTIAL. The runner and gateway helpers exist. Tokens are not locked in the database, so a restart can repeat a step. |
| Storage and ECM clients | PARTIAL. S3, Azure, GCS, SharePoint, CMIS, and REST clients exist. They are not covered by one shared contract suite, and GCS is still a narrow upload path. |
| Agent HTTP | PARTIAL. One handler. Idempotency rows exist. The handler still reads the in-memory snapshot. |
| MCP | NOT IMPLEMENTED as a process. A message helper returns tool JSON. |
| SDKs | PARTIAL. `src/sdk/client.ts` only. No Angular package, no web component. |
| Jobs and webhooks | PARTIAL. Tables and claim/retry helpers. Not Redis, not a worker process, not signed deliveries. |
| Audit hash chain | PARTIAL. Durable and verifiable for events that call `appendAudit`. Most product actions do not call it. |
| Observability | NOT IMPLEMENTED. No OpenTelemetry. |
| Admin and developer screens | PARTIAL. One admin page and one developer page. Not the route map in the prompt. |

## What this pass did not claim

Meridian is not production-ready. The acceptance gates in the prompt are not met. The scorecard for this pass is in `docs/productionization/ROADMAP.md`.
