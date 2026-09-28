-- Closure tables. Additive. Existing pdf, workflow, and flag rows stay.

alter table pdf_field_mappings add column if not exists rotation double precision not null default 0;
alter table pdf_field_mappings add column if not exists font text not null default 'Helvetica';
alter table pdf_field_mappings add column if not exists font_size double precision not null default 11;
alter table pdf_field_mappings add column if not exists alignment text not null default 'left';
alter table pdf_field_mappings add column if not exists format text;
alter table pdf_field_mappings add column if not exists required boolean not null default false;
alter table pdf_field_mappings add column if not exists overlay_id text;

alter table generated_documents add column if not exists status text not null default 'stored';
alter table generated_documents add column if not exists storage_provider text;
alter table generated_documents add column if not exists external_reference text;
alter table generated_documents add column if not exists created_by text;
alter table generated_documents add column if not exists pdf_template_id text;
alter table generated_documents add column if not exists source_hash text;
alter table generated_documents add column if not exists generated_hash text;

create table if not exists pdf_overlays (
  id text primary key,
  tenant_id text not null references tenants (id),
  template_id text not null,
  template_version int not null,
  page int not null,
  x double precision not null,
  y double precision not null,
  w double precision not null,
  h double precision not null,
  rotation double precision not null default 0,
  component_key text not null,
  pdf_field_type text not null,
  font text not null default 'Helvetica',
  font_size double precision not null default 11,
  alignment text not null default 'left',
  format text,
  required boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pdf_overlays_template on pdf_overlays (tenant_id, template_id, template_version, page);

create table if not exists publication_policies (
  tenant_id text not null references tenants (id),
  form_id text not null,
  mode text not null,
  start_at timestamptz,
  end_at timestamptz,
  max_submissions int,
  link_token_hash text,
  one_per_token boolean not null default false,
  allowed_embed_domains jsonb not null default '[]'::jsonb,
  allowed_origins jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, form_id)
);

create table if not exists prefill_tokens (
  token_hash text primary key,
  tenant_id text not null references tenants (id),
  form_id text not null,
  expires_at timestamptz not null,
  fields jsonb not null,
  protected_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists data_sources (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  kind text not null,
  config jsonb not null,
  secret_name text,
  cache_ttl_ms int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists lookup_cache (
  tenant_id text not null references tenants (id),
  source_id text not null,
  cache_key text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  primary key (tenant_id, source_id, cache_key)
);

create table if not exists notification_templates (
  tenant_id text not null references tenants (id),
  name text not null,
  subject text not null,
  body text not null,
  primary key (tenant_id, name)
);

create table if not exists notification_outbox (
  id text primary key,
  tenant_id text not null references tenants (id),
  template_name text not null,
  to_address text not null,
  payload jsonb not null,
  status text not null,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id text primary key,
  tenant_id text not null references tenants (id),
  target_type text not null,
  target_id text not null,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_target on comments (tenant_id, target_type, target_id);

create table if not exists form_edit_locks (
  tenant_id text not null references tenants (id),
  form_id text not null,
  holder_id text not null,
  revision int not null,
  expires_at timestamptz not null,
  primary key (tenant_id, form_id)
);

create table if not exists form_reviews (
  id text primary key,
  tenant_id text not null references tenants (id),
  form_id text not null,
  revision int not null,
  state text not null,
  author_id text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists abac_policies (
  id text primary key,
  tenant_id text not null references tenants (id),
  action text not null,
  expression text not null,
  enabled boolean not null default true
);

create table if not exists saved_views (
  id text primary key,
  tenant_id text not null references tenants (id),
  owner_id text not null,
  name text not null,
  resource text not null,
  filter jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists oidc_providers (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  issuer text not null,
  client_id text not null,
  secret_name text not null,
  scopes text not null default 'openid profile email',
  enabled boolean not null default true,
  unique (tenant_id, name)
);

create table if not exists flag_rules (
  tenant_id text not null references tenants (id),
  name text not null,
  scope text not null,
  scope_id text not null default '*',
  enabled boolean not null default false,
  rollout int not null default 100,
  primary key (tenant_id, name, scope, scope_id)
);

create table if not exists workflow_node_runs (
  id text primary key,
  tenant_id text not null references tenants (id),
  submission_id text not null,
  node_id text not null,
  status text not null,
  attempts int not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists workflow_node_runs_sub on workflow_node_runs (tenant_id, submission_id, node_id);
