# Observability

`src/lib/observe/otel.ts` keeps spans and counters in memory and can emit an OTLP-shaped JSON document. Nothing in this repository ships that document to a collector.

## Traces

`src/lib/observe/pipeline.ts` starts an HTTP span from a W3C `traceparent`, records status, and increments `http_requests_total` and `http_request_duration_seconds`. The same tracer can wrap a database call, a job, a workflow node, an AI call, PDF generation, storage, ECM, or a webhook. Those wrappers exist. They are not yet called from every request path.

## Logs

`redactLogLine` masks values that follow `password`, `token`, `secret`, or `authorization`. Do not log the OIDC client secret or an API key. `redactOidc` covers token fields in OIDC objects.

## Health

- Liveness: `GET /api/agent/v1/health/live`
- Admin counts: `GET /api/admin/console` includes users, forms, submissions, jobs, and open tasks.

## Correlation

Responses that go through `correlationHeaders` carry `x-request-id` and, when the caller sent one, `traceparent`.
