import { withTransaction, type Sql } from "../db.ts";

/** One command, one transaction, with the tenant pinned for the rest of the transaction. */
export function runTenantCommand<T>(tenantId: string, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return withTransaction(async (sql) => {
    await sql.query("select set_config('meridian.tenant', $1, true)", [tenantId]);
    return fn(sql);
  });
}
