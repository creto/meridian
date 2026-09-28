# Productionization roadmap

Order follows the prompt. Status is the state of this repository, not a promise.

| Phase | Work | Status |
| --- | --- | --- |
| 1 | Gap analysis, this roadmap, function map | COMPLETE as tracking documents |
| 2 | Postgres migrations for a relational workspace | PARTIAL. `0001` platform tables, `0002` forms, versions, submissions, revisions, workflow instances, outbox |
| 3 | Repository writes inside a transaction, tenant predicate on every row | PARTIAL. `replaceTenantWorkspace` / `loadTenantWorkspace`. Publish, submit, and task completion are not yet their own transactions |
| 4 | Multi-tenant isolation tests for forms and submissions | PARTIAL. One test. API, MCP, and task leaks are untested |
| 5 | Identity, durable sessions, Argon2id | NOT IMPLEMENTED. Existing users use scrypt. Platform sign-in stays off so the builder remains usable |
| 6 | RBAC enforced on every API | NOT IMPLEMENTED |
| 7 | API key rotation, scopes, last-used | NOT IMPLEMENTED beyond create, authenticate, revoke |
| 8 | Secrets from an external key, not a generated file | PARTIAL. `DATABASE_URL` without `MERIDIAN_MASTER_KEY` now fails. Preview still keeps a local key file |
| 9 | Forms and submissions loaded back from relational rows | PARTIAL. Boot prefers those rows when they exist |
| 10–16 | Files, durable workflow locking, Redis, signed webhooks, broad audit, PDF templates | NOT IMPLEMENTED |
| 17–21 | Storage contracts, ECM completion, agent services, MCP process, SDK packages | NOT IMPLEMENTED |
| 22–32 | Imports, grid virtualization, AI providers, admin, telemetry, security pass, load tests, Helm | NOT IMPLEMENTED |

## Next implementation step

Split publish and submit into their own transactions: validate, write the immutable version or the submission, write the workflow token, write the audit row, write the outbox row, commit. Stop projecting the entire workspace on each edit once those commands exist.

## Explicit non-goals of this pass

No empty packages. No second copy of the form renderer. No claim that a provider is connected without a successful round trip.
