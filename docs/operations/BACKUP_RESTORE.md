# Backup and restore

`scripts/backup.mjs` writes a JSONL logical backup of the tables listed in that script: tenants, forms, form versions, submissions, workflow tasks, generated documents, audit events, and jobs.

Object bytes and the secret ciphertext are not copied by that script. A restore of the JSONL does not recreate files that lived only in S3 or in the preview process memory.

## Restore order

1. Restore the database from the JSONL with `scripts/restore.mjs`.
2. Restore object storage from the provider's own backup. Meridian does not snapshot buckets.
3. Confirm the master key matches the key that encrypted `secret_refs`. A different key cannot decrypt them.
4. Run `scripts/verify-restore.mjs`. It checks that the restored rows match the backup. It does not measure a recovery-time number.

## Frequency

Run the backup on the schedule you can actually operate. The script does not claim a recovery point. The point is the time of the last successful run.
