# Disaster recovery

## What was restored

On 2026-10-01 a logical backup was applied to PostgreSQL 16.4 listening on this machine (`127.0.0.1:5433`, user `meridian`, database `meridian`). Migrations `0001` through `0004` were applied first. The restore inserted one tenant, one workspace, one form, one submission, and one job. Reading the submission back returned `legalName = Andes`. A second apply did not duplicate the submission.

That server is Postgres over the wire. It is not a cloud-hosted database. No hosted `DATABASE_URL` was provided, so this is not RDS, Neon, or Cloud SQL.

`node scripts/restore.mjs <backup-dir>` only prints the plan unless `DATABASE_URL` is set. With `DATABASE_URL` it inserts the rows in order: tenants, workspaces, forms, form versions, submissions, tasks, documents, audit, jobs. A checksum mismatch refuses the restore.

## Assumptions

- Recovery point: the last successful logical backup. There is no continuous WAL archive in this repository.
- Recovery time depends on the size of the dump. No number is published here.
- The preview embedded database is not a production backup.

## What is not covered

- SMTP, OIDC, S3, and ECM credentials. `node scripts/connectors-live.mjs` exits 2 while those variables are unset.
- A chart applied to a cluster. Helm can render the manifests. Docker and a Kubernetes API were not available here.
