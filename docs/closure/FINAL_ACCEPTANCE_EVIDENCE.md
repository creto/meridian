# Acceptance evidence

This is not a claim that Meridian is complete. Each gate says what ran.

| Gate | What ran | What did not |
|---|---|---|
| PDF | `editor-model.test.ts` covers move, hit test, align, distribute, undo, version bump. `closure.test.ts` covers AcroForm suggestions and a new document id on regenerate. The editor route renders. | Uploading an arbitrary PDF, flattening from the editor, and storing bytes were not exercised in a browser this pass. |
| Workflow | `runtime.test.ts` runs split, approval, timer, HTTP, one ALL join, PDF, ECM, email, then snapshot restore. A failed HTTP retries. Cancel is audited. | No worker was killed and restarted as a process. The test restores the JSON snapshot in-process. |
| Admin | Routes exist for tenants, users, roles, workspaces, storage, ECM, integrations, AI, API clients, webhooks, jobs, audit, flags, health, settings. `portal.test.ts` covers search, disable, revoke, secrets, job retry, and a broken audit hash. | Pages use a seeded snapshot, not a live SQL session in the browser. |
| SDK | `@meridian/angular` view models and `examples/angular/demo.mjs`. Web component class in `packages/web-component/meridian-form.js`. Existing `src/lib/sdk/client.ts`. | The Angular compiler is not installed. The custom element was not loaded in a browser during this pass. |
| Telemetry | `Tracer` writes W3C traceparent, redacts password, and exports OTLP-shaped JSON. Metric names are registered. | No collector received a span. |
| Plugins | `scaffoldComponent("VendorBadge")` returns definition, renderer, validator, and test. Untrusted ids throw. | A generated plugin was not registered into the live palette. |
| Publication | `POST /api/platform/publication/check` returns TOO_EARLY. Public link replay returns TOKEN_REPLAY. Prefill rejects a query override of a protected field. | The fill page does not call this yet. |
| Identity | OIDC authorize URL includes S256. Local session tests already covered Argon2. | No IdP redirect was performed. |
| Data sources | A country catalog returns cities. A slow response does not replace a newer one. Link-local URLs throw. | The select widget in the studio is still static options. |
| Notifications | Assignment template escapes HTML. The platform route returns status queued. | No SMTP connection. |
| Export | `rowsToXlsx` returns a non-trivial buffer. `planExportJob` is accepted by the platform route with 202. | The worker does not yet run that queue. |
| Collaboration | `saveEdit` returns STALE. The platform route returns 409. Comments reject empty bodies. | The studio save button does not send baseRevision yet. |
| DR | `scripts/backup.test.mjs` verifies a fixture and detects a changed row. | A Postgres dump was not taken. RPO is "since the last run of the script". |
| Accessibility | Contrast of the paper theme passes WCAG AA for normal text. The PDF editor listens for arrows, undo, and delete outside inputs. | No screen reader was run. |
| Performance | A 10,000-row window is under 40 rows. `runFieldBench` can time 50 to 1000 calculated fields. | k6 was not run. No latency numbers are invented. |
