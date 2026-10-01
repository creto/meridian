# Deployment

Meridian serves the web UI and the HTTP API from one Node process in preview. `scripts/worker.mjs` claims jobs, fires due timers, drains the outbox, and delivers signed webhooks. The agent request path does not resume timers.

## What is running

- Preview uses embedded Postgres. Its master key is kept in memory for that process and is not written beside the data.
- Production requires `MERIDIAN_ENV=production`, `DATABASE_URL`, `MERIDIAN_MASTER_KEY`, and `MERIDIAN_REQUIRE_AUTH=1`.
- SMTP, OIDC, S3, and ECM stay off until their variables are set. A missing credential is a failure, not a successful delivery.

## Chart and compose

- `infrastructure/docker-compose.yml` runs Postgres, an OTLP collector, migrate, web, and the worker. It does not start a privileged container.
- `infrastructure/helm/meridian` renders web, worker, and `otel-collector`. Secrets stay in `envFromSecret`. The chart sets `MERIDIAN_ENV`, `MERIDIAN_REQUIRE_AUTH`, and `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `helm template` renders this chart, including the collector. Docker is not installed here, and a Kubernetes API is not reachable, so compose was not started and the chart was not applied.

## Order

1. Apply migrations with `npm run db:migrate` when `DATABASE_URL` is set.
2. Start the web process.
3. Start the worker after the database accepts connections.
