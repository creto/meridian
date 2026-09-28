# Disaster recovery

## Assumptions

- Recovery point: the last successful logical backup. There is no continuous WAL archive in this repository.
- Recovery time: however long the restore and the object-storage restore take. No number is published here.
- The preview PGLite directory is not a production backup.

## Validation after restore

- `scripts/verify-restore.mjs` reports row mismatches.
- `GET /api/admin/console` should return a tenant snapshot and a hash chain of `ok: true` when the audit rows were part of the backup.
- A submission that existed before the backup should still list. A submission created after the backup will be gone. That is the recovery point.

## What is not covered

- Live connector credentials.
- In-memory generated PDF bytes held by the web process.
- The in-memory export queue. Durable jobs are the `jobs` table, claimed by `scripts/worker.mjs`.
