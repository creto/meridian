import { randomBytes } from "node:crypto";
import type { Queryable } from "../platform/durable.ts";
import { redactSecrets } from "../security/ssrf.ts";

export interface GenerationInput {
  provider: string;
  model: string;
  promptVersion: string;
  prompt: string;
  result?: unknown;
  formId?: string;
}

export interface GenerationRow {
  id: string;
  provider: string;
  model: string;
  prompt_version: string;
  prompt: string;
  result: unknown;
  form_id: string | null;
  created_at: string | Date;
}

async function ensureTenant(db: Queryable, tenantId: string) {
  await db.query("insert into tenants (id, name) values ($1, $2) on conflict (id) do nothing", [tenantId, tenantId]);
}

export async function recordGeneration(db: Queryable, tenantId: string, input: GenerationInput): Promise<string> {
  await ensureTenant(db, tenantId);
  const id = `gen_${randomBytes(8).toString("hex")}`;
  const prompt = redactSecrets(input.prompt).slice(0, 8000);
  await db.query(
    `insert into ai_generations (id, tenant_id, provider, model, prompt_version, prompt, result, form_id)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [id, tenantId, input.provider, input.model, input.promptVersion, prompt, input.result == null ? null : JSON.stringify(input.result), input.formId ?? null],
  );
  return id;
}

export async function listGenerations(db: Queryable, tenantId: string, limit = 50): Promise<GenerationRow[]> {
  const cap = Math.min(Math.max(limit, 1), 200);
  return db.query<GenerationRow>(
    `select id, provider, model, prompt_version, prompt, result, form_id, created_at
     from ai_generations where tenant_id = $1 order by created_at desc limit $2`,
    [tenantId, cap],
  );
}
