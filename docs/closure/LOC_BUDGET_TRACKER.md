# LOC budget tracker

`git diff --shortstat HEAD` after this closure, including untracked files: about **9,100 insertions** across the closure work. That is below the 12,000 figure in the chat and below the planning ranges in the prompt. Lines were not added to close the gap.

Counts below are a depth check, not a quota. Status stays PARTIAL wherever a gate is not proven end to end.

| Subsystem | Status | What runs | What does not |
|---|---|---|---|
| PDF editor | PARTIAL | Normalized editor, save writes `pdf_overlays`, placed fields render to PDF bytes | Arbitrary PDF upload and AcroForm flatten from the editor are not the save path |
| Workflow | PARTIAL | Interpreter covers the acceptance graph and resumes from a JSON snapshot | No separate worker restart of an in-flight SQL token |
| Admin | PARTIAL | Pages call `GET/POST /api/admin/console`, which reads and writes Postgres | Not every admin control edits every column |
| Developer | PARTIAL | Sectioned portal and a generated OpenAPI document | Try-it only sends the safe operations |
| SDK | PARTIAL | Angular view models compile. Web component source exposes the attributes | No Angular compiler. Web component was not upgraded in a browser |
| Access | PARTIAL | `admitFill` enforces mode, prefill, and ABAC. Rows persist | The public fill page still saves in the browser workspace |
| Collaboration | PARTIAL | Stale revision and locks are enforced by `/api/platform/studio/save` | Studio save does not call that route yet |
| Notifications | PARTIAL | Outbox insert and deliver against Postgres. Templates escape HTML | No SMTP socket |
| Search | PARTIAL | Cursor SQL, saved views, XLSX, ZIP bundle, in-memory export job | The search page filters the browser workspace, not the SQL cursor |
| OIDC | PARTIAL | Authorize URL, PKCE, state, nonce | ID token signatures are not verified |
| Connectors | PARTIAL | Capability matrix is explicit about partial and missing cells | Admin test does not open a socket |
| DR | PARTIAL | JSONL backup, restore, verify | No WAL archive and no numeric RPO |
| Performance | PARTIAL | In-process field and grid numbers in `docs/performance/LOAD_TEST_REPORT.md` | No k6 result |

Do not add lines to move a row's actual count toward the estimate.
