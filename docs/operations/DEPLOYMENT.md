# Deployment

Meridian serves the web UI and the HTTP API from one Node process in preview. A second process, `scripts/worker.mjs`, claims rows from `jobs` when `DATABASE_URL` is set.

## What is running

- Preview and local development use embedded Postgres (PGLite) under `data/pglite`.
- A hosted database is used only when `DATABASE_URL` is set. The master key must already exist. This repository does not invent one.
- Helm sketches live in `infrastructure/helm/meridian`. They are not a tested cluster.

## Chart

- `web` serves the app and the agent API.
- `api` is the same image, split out so it can scale separately later.
- `worker` runs `scripts/worker.mjs`. It does not expose HTTP. Liveness is an exec probe.
- `mcp` does not open a port. Tool JSON is `GET /api/agent/v1/mcp/tools` on the API.
- `pdf` and `ai` deployments render only when their replica count is above zero. Default is zero.
- Ingress, an HPA, a pod disruption budget, and a config map are in `templates/ingress.yaml`.
- Secrets come from the secret named by `envFromSecret`. Do not put `MERIDIAN_MASTER_KEY` in the chart.

## Order

1. Apply migrations. `npm run db:migrate` does this when `DATABASE_URL` is set. PGLite applies the same files on first query.
2. Start the web process.
3. Start the worker only after the database accepts connections.
