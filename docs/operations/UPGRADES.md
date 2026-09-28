# Upgrades

Migrations in `migrations/` are applied in filename order. Each file is recorded in `_migrations` and is not run twice.

## Rules

- Add a new file. Do not edit a migration that has already been applied to a shared database.
- `0004_closure.sql` is additive. It does not rewrite submission JSON.
- The auth schema under `migrations/auth/` is not applied. Better Auth stays off.
- Do not change `src/lib/auth/server.ts` as part of an upgrade unless that file is the thing being fixed.

## Application

- With `DATABASE_URL`: `npm run db:migrate` during build.
- Without it: the embedded database applies the files on startup.

After a migration, restart the worker so it sees new job columns. The web process picks up SQL files when its database client is created. A long-lived process that already migrated will not see a new file until it starts again.
