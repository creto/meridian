# Function migration map

Status is KEEP, REFACTOR, or REPLACE. "Done" means this pass changed the target. "Open" means the current function is still the implementation.

| Current | File | Responsibility | Decision | Target | Status | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `persistSnapshot` | `src/lib/platform/durable-server.ts` | Save the workspace | REFACTOR | Transaction: export cache plus `replaceTenantWorkspace` | Done | `workspace-store.test.ts` |
| `saveWorkspace` / `loadWorkspace` | `src/lib/platform/durable.ts` | JSON blob | REPLACE as primary | Kept as export cache. Boot reads relational rows first | Done | platform tests still cover the blob |
| `readSnapshot` / `writeSnapshot` / `mutateSnapshot` | `src/lib/platform/snapshot.ts` | Process memory | REPLACE as primary | Keep for the request cache and for tests | Open | — |
| `replaceTenantWorkspace` | `src/lib/domain/workspace-store.ts` | Relational write | KEEP | Domain store | Done | tenant isolation round trip |
| `loadTenantWorkspace` | `src/lib/domain/workspace-store.ts` | Relational read | KEEP | Domain store | Done | same |
| `applyCalculations` | `src/lib/forms/engine.ts` | Formulas | REFACTOR | Dependency order per object and per grid | Done | engine test "calculated fields follow dependencies" |
| `compileExpression` | `src/lib/forms/expressions.ts` | Safe parser | KEEP | Length and token caps added | Done | existing expression test |
| `calculationCycles` | `src/lib/forms/engine.ts` | Cycle report | KEEP | Unchanged | Open | — |
| `advanceServices` | `src/lib/forms/workflow-run.ts` | Workflow side effects | REFACTOR | Workflow runtime with locked tokens | Open | platform workflow test |
| `buildPdf` | `src/lib/forms/pdf.ts` | Stacked report | KEEP | `SimpleReportPdfGenerator`. Not the template system | Open | engine PDF test |
| `handleAgent` | `src/lib/platform/agent-http.ts` | Agent HTTP | REFACTOR | Form, submission, workflow, file, schema services | Open | — |
| `createS3Provider` | `src/lib/storage/s3.ts` | S3 client | KEEP | Shared provider contract later | Open | storage tests |
| `login` | `src/lib/platform/durable.ts` | Email and scrypt | REFACTOR | Auth service, Argon2id, real sessions | Open | platform login test |
| `can` / `grantsFor` | `src/lib/platform/rbac.ts` | Role map | REFACTOR | `authorize({ actor, action, resource })` on the server | Open | — |
| `masterKey` | `src/lib/platform/durable-server.ts` | AES key | REFACTOR | Env or KMS in production. No generated key when `DATABASE_URL` is set | Done | — |
| `appendAudit` / `verifyAuditChain` | `src/lib/platform/durable.ts` | Hash chain | KEEP | Call it from publish, submit, and admin. Do not store secrets | Open | platform audit test |
| `enqueueJob` / `claimDueJobs` / `finishJob` | `src/lib/platform/durable.ts` | Job table | REFACTOR | Worker process. Postgres skip-locked stays until a queue is justified | Open | platform job test |
| `enqueueWebhook` / `recordWebhookAttempt` | `src/lib/platform/durable.ts` | Delivery rows | REFACTOR | Outbox, HMAC, dead letter | Open | platform webhook test |
| `proposeEdit` / `proposalFromModel` | assistant, llm | AI patch | KEEP | Validate before apply. Domain packs later | Open | llm tests |
| `importFormio` | `src/lib/forms/importing.ts` | Form.io JSON | REFACTOR | Adapter registry with support classification | Open | — |
| `handleMcpMessage` | `src/lib/platform/mcp-runtime.ts` | Tool JSON | REPLACE | Authenticated MCP process | Open | platform MCP test |
| `createMeridianClient` | `src/sdk/client.ts` | HTTP client | KEEP | Package later. Do not fork it | Open | — |

Screen components (`Studio`, `FormRuntime`, `Dashboard`, `AgentPage`, `AdminPage`) stay. They are not split in this pass. Splitting them without a new behavior would only move lines.
