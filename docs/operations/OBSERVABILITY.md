# Observability

`src/lib/observe/otel.ts` builds an OTLP JSON document. The worker posts it when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. If the variable is empty, nothing is exported and the job still finishes.

Compose and the Helm chart run `otel/opentelemetry-collector` and point web and worker at `http://<release>-otel:4318`. That collector is part of the rendered manifest. It is not proof that a cluster received spans.

## Health

- Liveness: `GET /api/agent/v1/health/live`
- Readiness includes the production posture: database, master key, required auth, and which connectors are configured.

## Logs

`redactLogLine` masks values that follow `password`, `token`, `secret`, or `authorization`. Do not log the OIDC client secret or an API key.
