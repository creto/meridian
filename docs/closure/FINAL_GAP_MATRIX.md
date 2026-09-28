# Final gap matrix

Inspection date: 2026-09-28. Status is taken from the code that is in the tree, not from names alone.

Allowed values: COMPLETE, PARTIAL, MISSING, DEFERRED_WITH_REASON.

This file is the closure baseline. Rows move to COMPLETE only when the acceptance evidence names a test or a route that exercises the behavior.

| Requirement | Status | Evidence | API | UI | Persistence | Tests | Remaining | Phase |
|---|---|---|---|---|---|---|---|---|
| Safe expression parser, no eval | COMPLETE | src/lib/forms/expressions.ts | engine | runtime | n/a | engine.test.ts, expressions covered there | none | done |
| Dependency-ordered calculations | COMPLETE | src/lib/forms/engine.ts calculationOrder | engine | runtime | n/a | engine.test.ts | none | done |
| Immutable published versions | COMPLETE | src/lib/domain/commands.ts publishForm | agent publish | studio | form_versions | commands.test.ts | none | done |
| Tenant-scoped submissions | COMPLETE | commands.ts submitForm | agent submit | fill | submissions | persistence.suite.test.ts | none | done |
| Argon2id passwords | PARTIAL | src/lib/identity/passwords.ts plus scrypt in platform/crypto.ts | login | none dedicated | users | identity/sessions.test.ts | Local login UI is the hosted gate, not a Meridian password form. Argon2id exists; platform crypto still has scrypt for older rows | identity |
| API key hash, rotate, revoke | COMPLETE | src/lib/platform/api-keys.ts | agent bearer | developer | api_keys | platform tests | none | done |
| Audit hash chain | COMPLETE | appendAudit / verifyAuditChain | none public yet | admin audit page landing with this change | audit_events | security/closure.test.ts | export of the chain is still a page action | admin |
| AcroForm inspect, fill, flatten | COMPLETE | src/lib/pdf/acroform.ts | internal | not yet a wizard | pdf templates | acroform.test.ts | UX that lists fields and saves a mapping | pdf |
| Visual PDF template editor | PARTIAL | src/lib/pdf/editor-model.ts | none yet | route /pdf/templates/:id/editor landing with this change | pdf_overlays in 0004 | editor-model.test.ts | wire save to SQL and byte download of a flattened file from the editor | pdf |
| Generated document records | PARTIAL | generated_documents table | none yet | none yet | 0003 + 0004 columns | landing with generated-docs tests | download and history UI | pdf |
| Workflow tokens and human tasks | COMPLETE | durable-runtime.ts, commands completeWorkflowTask | agent task complete | inbox | workflow_tokens, workflow_tasks | durable-runtime.test.ts | none for the basic task | workflow |
| Join ALL / ANY / N-of-M, single continuation | PARTIAL | runtime.ts arriveAtJoin; graph.ts validates n | internal | flow pane join field | joins are in the run snapshot, not yet a column | runtime.test.ts | persist join marks; prove a restarted worker | workflow |
| Workflow node handlers (http, pdf, ecm, email, ai, timer) | PARTIAL | src/lib/workflow/runtime.ts | none | canvas editor landing | workflow_node_runs table unused by the runner | runtime.test.ts | worker process that calls step() on a clock | workflow |
| Visual workflow editor | PARTIAL | editor-model.ts plus canvas landing | none | /workflows/:id/editor | workflow_versions | editor-model.test.ts | publish from the canvas | workflow |
| Operator retry, skip, cancel, reassign | PARTIAL | runtime.ts | none | none | audit log events in the run | runtime.test.ts | HTTP endpoints and admin buttons | workflow |
| Admin directory | PARTIAL | src/lib/admin/directory.ts | SQL helpers | /admin hub | users, roles | directory.test.ts | dedicated routes per area | admin |
| Dedicated admin pages | PARTIAL | routes being added | /api not unified | /admin/users and siblings | existing tables | portal tests landing | every page must call the SQL helpers, not only fixtures | admin |
| Developer portal and OpenAPI explorer | PARTIAL | developer.tsx, schema-export.ts | agent openapi | /developer | none | catalog tests landing | interactive try-it against the live agent | developer |
| TypeScript SDK | COMPLETE | src/lib/sdk/client.ts | client | n/a | n/a | sdk/client.test.ts | examples must stay compiling | sdk |
| Angular SDK | MISSING | no package yet | n/a | n/a | n/a | none | package and example | sdk |
| Web component | PARTIAL | embed contract only | n/a | no element | n/a | embed/contract.test.ts | custom element that fetches the agent API | sdk |
| MCP | COMPLETE | src/lib/mcp/protocol.ts | mcp | n/a | n/a | protocol.test.ts | none for the protocol | sdk |
| OpenTelemetry traces and metrics | PARTIAL | src/lib/observe/trace.ts redacts secrets | none | none | in memory | trace.test.ts | W3C traceparent and the metric set | telemetry |
| Plugin SDK and CLI | MISSING | registry is internal | n/a | n/a | n/a | none | scaffold plus trust check | plugins |
| Publication modes | MISSING | no policy type | n/a | n/a | publication_policies in 0004 | none yet | enforce on fill and agent submit | access |
| Signed prefill | MISSING | n/a | n/a | n/a | prefill_tokens in 0004 | none yet | HMAC token and protected fields | access |
| OIDC authorization code + PKCE | MISSING | local passwords only. Better Auth is intentionally not enabled | n/a | hosted gate is not OIDC | oidc_providers in 0004 | none yet | discovery, PKCE, claim map. Live IdP is deferred until a tenant stores an issuer | identity |
| Data sources and cascading selects | MISSING | selects are static options | n/a | n/a | data_sources in 0004 | none yet | REST lookup with stale-response guard | data |
| Async validation | MISSING | validateField is synchronous | n/a | n/a | n/a | none | debounced server check | data |
| Notification providers | PARTIAL | notify/template.ts escapes HTML | none | none | notification_outbox in 0004 | template tests | SMTP and HTTP providers, queued send | notify |
| Cursor search and XLSX export job | PARTIAL | search/query.ts | none | data pane is not cursor based | saved_views in 0004 | query.test.ts | async xlsx job | search |
| ABAC | MISSING | RBAC only in authz/authorize.ts | agent authorize | none | abac_policies in 0004 | authorize tests for RBAC | expression policies on the server | access |
| Collaboration lock and stale edit | MISSING | n/a | n/a | studio last-write-wins in the client store | form_edit_locks in 0004 | none yet | reject stale revision | collab |
| Comments outside submission JSON | MISSING | task comment is a column on the task | task complete body | inbox comment field | comments table in 0004 | none yet | form, submission, and task targets | collab |
| Feature flag targeting | PARTIAL | feature_flags boolean per tenant | none | none | flag_rules in 0004 | directory flag helpers | user, workspace, percentage | flags |
| Backup, restore, verify | MISSING | no script | n/a | n/a | n/a | none | scripts plus a fixture test. No numeric RPO claimed | dr |
| Accessibility and per-form locale | PARTIAL | focus-visible in CSS, i18n/catalog.ts | n/a | partial | n/a | catalog.test.ts | keyboard traps, contrast, formatters | ux |
| Performance numbers | MISSING | grid visible window exists | n/a | n/a | n/a | none | measured bench, no invented latencies | perf |
| Connector matrix | PARTIAL | provider implementations | storage test route | admin storage page | storage_profiles | contract tests, capability.test.ts | live cloud calls remain DEFERRED_WITH_REASON without credentials | connectors |
| Generic REST ECM | PARTIAL | putRest | storage put | none | ecm_profiles | none yet | URL templates, SSRF, id path | connectors |
| Helm web and worker | PARTIAL | infrastructure/helm/meridian | n/a | n/a | n/a | none | api, mcp, pdf, ai, ingress, HPA, PDB | ops |
| CI | PARTIAL | .github/workflows/meridian-ci.yml | n/a | n/a | n/a | the workflow | typecheck and new tests in the job | ops |

## Deferred with reason

| Item | Reason |
|---|---|
| Live GCS, Azure, SharePoint, CMIS, SMTP, and OIDC calls | No tenant credentials are stored in this workspace. Adapters and contract tests exist. A live call would be forged if reported as passed. |
| k6 against a public deployment | A load script can time local CPU work. It cannot honestly report HTTP latency for a deployment that is not running those routes under k6. |
| Redis | Not part of the current process model. Jobs are rows in Postgres. Adding Redis would be a second queue without a requirement that the existing jobs table failed. |
| Full Angular compiler in the root app | The Angular package typechecks on its own tsconfig so the root app does not take a framework dependency. |
| CRDT multiplayer | Explicitly out of scope. Locks and revision checks are the collaboration model. |

## Authoritative paths

See docs/closure/AUTHORITATIVE_PATHS.md once that note is in the tree. Until then:

- Server submission and publish commands are authoritative. The browser store is a cache that syncs through /api/agent/v1/sync.
- src/lib/workflow/runtime.ts is the interpreter for the acceptance flow. src/lib/workflow/durable-runtime.ts remains the SQL token and task store. In-memory gateway helpers are a preview fallback.
- pdf-lib AcroForm functions remain the byte path. The editor model places normalized fields on top of them.
- Snapshot JSON remains a cache. replaceTenantWorkspace is the relational write.
