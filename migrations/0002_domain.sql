-- Relational system of record. The workspace JSON blob remains an export cache.
-- Tenant id is a required column on every row. Applied after 0001.

create table if not exists workspaces (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists forms (
  id text primary key,
  tenant_id text not null references tenants (id),
  workspace_id text not null references workspaces (id),
  name text not null,
  title text not null,
  description text not null default '',
  display text not null,
  status text not null,
  version int not null,
  has_unpublished_changes boolean not null default true,
  schema jsonb not null,
  workflow jsonb,
  settings jsonb not null,
  storage jsonb,
  targets jsonb,
  tags jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  pdf_pages int not null default 1,
  source text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  published_at timestamptz,
  unique (tenant_id, name)
);

create index if not exists forms_tenant on forms (tenant_id);

create table if not exists form_versions (
  tenant_id text not null references tenants (id),
  form_id text not null references forms (id) on delete cascade,
  version int not null,
  saved_at timestamptz not null,
  note text not null,
  title text not null,
  display text not null,
  schema jsonb not null,
  workflow jsonb,
  primary key (tenant_id, form_id, version)
);

create table if not exists submissions (
  id text primary key,
  tenant_id text not null references tenants (id),
  workspace_id text not null references workspaces (id),
  form_id text not null,
  form_name text not null,
  form_version int not null,
  status text not null,
  data jsonb not null,
  workflow jsonb,
  documents jsonb not null default '[]'::jsonb,
  idempotency_key text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists submissions_tenant_form on submissions (tenant_id, form_id);

create table if not exists submission_revisions (
  tenant_id text not null references tenants (id),
  submission_id text not null references submissions (id) on delete cascade,
  seq int not null,
  at timestamptz not null,
  actor text not null,
  note text not null,
  data jsonb not null,
  primary key (tenant_id, submission_id, seq)
);

create table if not exists workflow_instances (
  submission_id text primary key references submissions (id) on delete cascade,
  tenant_id text not null references tenants (id),
  status text not null,
  current_node text,
  state jsonb not null,
  updated_at timestamptz not null
);

create index if not exists workflow_instances_tenant on workflow_instances (tenant_id);

create table if not exists outbox_events (
  id text primary key,
  tenant_id text not null references tenants (id),
  topic text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists outbox_unpublished on outbox_events (tenant_id, published_at);
