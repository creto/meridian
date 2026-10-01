# Productionization roadmap

Status is the state of this repository on the current tree. It is not a claim that a cluster or a cloud account is connected.

| Phase | Work | Status |
| --- | --- | --- |
| 1 | Gap analysis and this roadmap | COMPLETE as tracking documents |
| 2 | Postgres migrations | COMPLETE as files `0001`–`0004`. Production refuses to boot on the embedded database |
| 3 | Transactions for publish, submit, and task completion | COMPLETE. Each command locks its row and pins `meridian.tenant` |
| 4 | Multi-tenant isolation | COMPLETE for API keys, task completion, and the preview snapshot. Another tenant's key cannot finish, rotate, or read the preview workspace |
| 5 | Argon2id passwords | COMPLETE for new hashes. Production rejects scrypt. There is still no hosted password form; the preview stays open |
| 6 | RBAC on agent, admin, platform, storage, and webhook routes | COMPLETE. Preview without a key remains the Northwind owner |
| 7 | API key issue, authenticate, rotate, revoke | COMPLETE. Rotation and revoke are tenant scoped |
| 8 | Master key | COMPLETE for deploy. `MERIDIAN_MASTER_KEY` is required with a managed database. The preview key stays in memory and is not written to disk |
| 9 | Relational forms and submissions | COMPLETE for publish, submit, and worker timer reads |
| 10 | Signed webhooks and durable outbox | COMPLETE. The worker drains the outbox and signs deliveries |
| 11 | Worker for jobs, timers, and mail | COMPLETE. Due timers advance only in the worker. Mail is not marked sent unless SMTP accepts it |
| 12 | Storage, ECM, SMTP, OIDC | PARTIAL. Protocol round-trips exist. Without credentials the paths stay off. No live cloud account is configured here |
| 13 | OpenTelemetry | PARTIAL. Spans export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Compose and Helm start a collector. A cluster has not accepted the chart |
| 14 | Helm and compose | PARTIAL. `helm template` renders the chart. Docker is not available in this workspace, so compose has not been started |
| 15 | Playwright | COMPLETE as `e2e/agent-browser.e2e.mjs`, wired in CI |
| 16 | Backup and restore order | COMPLETE as checksum plus table order. A production restore has not been run against a hosted database |
| 17–21 | Angular SDK, plugins, ABAC, signed prefill, publication modes | NOT IMPLEMENTED |
| 22 | Collaboration locks and load tests | NOT IMPLEMENTED |

## Still open

1. Compose has not been started and Helm has not been applied. `helm template` renders the chart. This workspace has no Docker daemon and no Kubernetes API.
2. SMTP, OIDC, S3, and ECM stay off. `scripts/connectors-live.mjs` exits 2 until those variables are set, then it requires a real answer. No credentials were invented.
3. Logical restore runs against Postgres. It was executed on PostgreSQL 16.4 in this workspace and the submission was read back. A cloud-hosted database was not available.
4. Not part of the internal deploy: Angular SDK, plugins, ABAC, signed prefill, publication modes, collaboration locks, and load tests. Those are not built.

