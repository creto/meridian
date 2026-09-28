# Meridian implementation gap analysis

Inspected from the running TanStack Start app in this repository. Statuses describe what the code does, not what the original master prompt asked for. Supplier registration remains a form definition on top of the generic engine.

Legend: COMPLETE, PARTIAL, NOT IMPLEMENTED. PLACEHOLDER means a control exists that does not perform the operation.

## Platform shape

| Area | Status | What exists |
| --- | --- | --- |
| Form schema, renderer, wizard, conditionals, calculations, validation | COMPLETE | Safe expression language. No eval. Hidden fields skip required. |
| Drag/drop builder, tree, inspector, undo, JSON, logic, versions, diff | COMPLETE | Keyboard duplicate/delete/copy/paste. Palette search. |
| Supplier registration | COMPLETE | Template plus generated Spanish brief. Not hardcoded inside the workflow runner. |
| Submissions, drafts, idempotency, agent rate limit | COMPLETE | Browser workspace is the system of record. |
| Local PDF bytes + SHA-256 | COMPLETE | Generated on the pdf service node and stored in the workspace archive. |
| Inbox approvals | COMPLETE | Human and approval nodes. Storage failure stops the flow and surfaces the error. |
| Excel / CSV import | PARTIAL | `.xlsx` via SheetJS. Every sheet is listed and the chosen sheet is imported. Field-table or column profile, with confidence warnings. `.xls` only if SheetJS can read it. |
| JSON / JSON Schema / Form.io import | PARTIAL | Nested Form.io components import. Legacy JavaScript is recorded and never executed. |
| PDF field placement | PARTIAL | Percent placement on a blank page. No uploaded template, thumbnails, AcroForm detection, or flatten of an existing PDF. |
| Editable grid | PARTIAL | Inline edit, add, remove, reorder, filter, sort, numeric sum and average. Row formulas use SUM, AVG, MIN, MAX, COUNT, IF. No virtualization. |

## Storage and ECM

| Provider | Status | Behavior |
| --- | --- | --- |
| Workspace archive | COMPLETE | Put, get, delete, list, stat, SHA-256. Bytes persist in IndexedDB in the browser and in memory on the server. Signed URLs are refused with NOT_SUPPORTED. |
| S3 and MinIO | COMPLETE as a client | AWS Sig V4 (checked against the published AWS example). Path-style endpoints. Put/get/delete/head/list, presigned URLs, multipart for objects over 8MB, retries on 5xx. Test connection writes, reads, and deletes `meridian-healthcheck.txt`. It does not report success without that round trip. |
| Azure Blob | COMPLETE as a client | Shared Key block blob upload. Test connection is the upload. |
| Google Cloud Storage | PARTIAL | Media upload with a bearer token. Service-account JWT minting is not implemented. |
| SharePoint | COMPLETE as a client | Microsoft identity client-credentials token, then Microsoft Graph site read, folder list/create, content upload and download. Failure returns Graph's status and body. |
| CMIS | COMPLETE as a client | Browser binding: repository discovery, children, createFolder, createDocument, content download. |
| Generic REST | COMPLETE as a client | PUT to the configured endpoint with an optional bearer token. |
| Credential vault | PARTIAL | Secrets are kept in server process memory, never written into form JSON or browser storage, and never returned by the API. A process restart drops them. This is not a KMS. |
| MinIO in CI | NOT IMPLEMENTED | Tests hit an S3-protocol HTTP fixture that checks the Authorization header and stores bytes. That fixture is not MinIO. |
| Multi-destination form routing | PARTIAL | A form can select separate connections for the approved PDF, the submission JSON, and the archive, plus a path template. A remote connection is used only after Test connection succeeded. Attachments remain SHA-256 metadata in the submission, not a third upload. |

A form that only names S3, SharePoint, or CMIS, without a tested connection, does not archive. The workflow records `storage-failed` and does not move to the end state.

## Workflow

| Node | Status |
| --- | --- |
| Start, human, approval, end | COMPLETE |
| Service: pdf, archive | COMPLETE |
| HTTP / webhook node | COMPLETE when a URL is set. The call is real. Missing URL stops the flow. |
| Decision | COMPLETE. Edges whose `when` is an expression are evaluated with the safe language. |
| Timer, parallel split, join | NOT IMPLEMENTED. The definition is stored and the runner stops with `not-executed`. It does not pretend the timer fired. |

The supplier path (procurement, finance, pdf, archive) is ordinary workflow JSON.

## Agent, SDK, documents

| Item | Status |
| --- | --- |
| In-app agent console | COMPLETE |
| HTTP ` /api/agent/v1/forms`, schema, capabilities, tool definition, OpenAPI, validate, submit, get/patch submission, generate | COMPLETE against the server snapshot. The browser workspace syncs into that snapshot. Generate on this route is the on-device designer. |
| Idempotency on the HTTP submit | COMPLETE |
| TypeScript client `src/sdk/client.ts` | COMPLETE |
| Angular SDK | NOT IMPLEMENTED |
| MCP stdio server | NOT IMPLEMENTED. `GET /api/agent/v1/mcp/tools` returns tool JSON, including one submit tool per published form. There is no MCP process. |
| Grok form generation | COMPLETE when `XAI_API_KEY` is present. Otherwise the on-device designer runs and the UI says so. No other model vendor is called. |

## Identity, tenancy, operations

| Item | Status |
| --- | --- |
| Workspace RBAC | PARTIAL. Roles owner, designer, clerk, reviewer, agent, viewer are enforced inside workspace mutations. There is no login and no second tenant. |
| Multi-tenancy and PostgreSQL row isolation | NOT IMPLEMENTED. One browser workspace. |
| Audit log | PARTIAL. Append-only events in the workspace for create, role change, and workflow actions. Not tamper-evident across devices. |
| Webhooks | PARTIAL. Admin can save a URL and a signing secret. The secret is stored in the server vault and is not written into the browser. Delivery signs with HMAC, retries 5xx and network errors three times, and does not retry other 4xx. Not an outbox that survives restart. Saving a webhook does not pretend a delivery succeeded. |
| Jobs, SSE progress, OpenTelemetry | NOT IMPLEMENTED |
| Users, API keys, feature flags as an identity system | NOT IMPLEMENTED |

## Tests

`src/lib/forms/engine.test.ts` covers expressions (including AVG, COUNT, IF), supplier conditionals, grid formulas, the Spanish brief, CSV profiling, multi-sheet workbook import, and PDF headers.

`src/lib/storage/storage.test.ts` covers the AWS Sig V4 vector, local put/get/delete, RBAC grants, the supplier archive writing a real PDF, and the S3 client against a local HTTP fixture.
