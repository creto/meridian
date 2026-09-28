-- Domain tables that are not the workspace JSON blob.
-- Every row carries tenant_id. Applied after 0002.

alter table sessions add column if not exists last_seen_at timestamptz;
alter table sessions add column if not exists revoked_at timestamptz;
alter table users add column if not exists failed_logins int not null default 0;
alter table users add column if not exists locked_until timestamptz;

alter table api_keys add column if not exists role text not null default 'agent';
alter table api_keys add column if not exists ip_restrictions jsonb not null default '[]'::jsonb;
alter table api_keys add column if not exists rotated_from text;
alter table api_keys add column if not exists workspace_id text;

create table if not exists tenant_settings (
  tenant_id text primary key references tenants (id),
  retention text not null default 'forever',
  retention_days int,
  locale text not null default 'en',
  legal_hold boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  name text primary key
);

create table if not exists roles (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  unique (tenant_id, name)
);

create table if not exists role_permissions (
  role_id text not null references roles (id) on delete cascade,
  permission text not null references permissions (name),
  primary key (role_id, permission)
);

create table if not exists user_roles (
  tenant_id text not null references tenants (id),
  user_id text not null references users (id) on delete cascade,
  role_id text not null references roles (id) on delete cascade,
  primary key (tenant_id, user_id, role_id)
);

create table if not exists workspace_memberships (
  tenant_id text not null references tenants (id),
  workspace_id text not null references workspaces (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  role_name text not null,
  primary key (tenant_id, workspace_id, user_id)
);

create table if not exists form_tags (
  tenant_id text not null references tenants (id),
  form_id text not null references forms (id) on delete cascade,
  tag text not null,
  primary key (tenant_id, form_id, tag)
);

create table if not exists submission_drafts (
  id text primary key,
  tenant_id text not null references tenants (id),
  form_id text not null,
  resume_token_hash text not null unique,
  data jsonb not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists files (
  id text primary key,
  tenant_id text not null references tenants (id),
  workspace_id text not null,
  submission_id text,
  field_key text,
  filename text not null,
  sanitized_filename text not null,
  mime text not null,
  size int not null,
  sha256 text not null,
  provider text not null,
  object_key text not null,
  status text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists files_tenant on files (tenant_id, submission_id);

create table if not exists file_versions (
  tenant_id text not null references tenants (id),
  file_id text not null references files (id) on delete cascade,
  version int not null,
  sha256 text not null,
  size int not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, file_id, version)
);

create table if not exists file_links (
  id text primary key,
  tenant_id text not null references tenants (id),
  file_id text not null references files (id) on delete cascade,
  submission_id text,
  field_key text,
  created_at timestamptz not null default now()
);

create table if not exists pdf_templates (
  id text primary key,
  tenant_id text not null references tenants (id),
  form_id text,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists pdf_template_versions (
  tenant_id text not null references tenants (id),
  template_id text not null references pdf_templates (id) on delete cascade,
  version int not null,
  sha256 text not null,
  page_count int not null,
  byte_length int not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, template_id, version)
);

create table if not exists pdf_field_mappings (
  tenant_id text not null references tenants (id),
  template_id text not null,
  template_version int not null,
  pdf_field text not null,
  form_key text not null,
  field_type text not null,
  page int,
  x double precision,
  y double precision,
  w double precision,
  h double precision,
  primary key (tenant_id, template_id, template_version, pdf_field)
);

create table if not exists generated_documents (
  id text primary key,
  tenant_id text not null references tenants (id),
  submission_id text not null,
  form_version int not null,
  submission_revision int not null,
  template_version int,
  source_template_hash text,
  generated_pdf_hash text not null,
  generated_at timestamptz not null default now()
);

create table if not exists workflow_definitions (
  id text primary key,
  tenant_id text not null references tenants (id),
  form_id text not null,
  name text not null
);

create table if not exists workflow_versions (
  tenant_id text not null references tenants (id),
  definition_id text not null references workflow_definitions (id) on delete cascade,
  version int not null,
  definition jsonb not null,
  primary key (tenant_id, definition_id, version)
);

create table if not exists workflow_tokens (
  id text primary key,
  tenant_id text not null references tenants (id),
  submission_id text not null,
  node_id text not null,
  branch_id text not null,
  status text not null,
  arrived_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists workflow_tokens_tenant on workflow_tokens (tenant_id, submission_id, status);

create table if not exists workflow_tasks (
  id text primary key,
  tenant_id text not null references tenants (id),
  submission_id text not null,
  node_id text not null,
  assigned_role text,
  assigned_user text,
  claimed_by text,
  status text not null,
  due_at timestamptz,
  decision text,
  comment text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists workflow_tasks_open on workflow_tasks (tenant_id, status);

create table if not exists workflow_events (
  id text primary key,
  tenant_id text not null references tenants (id),
  submission_id text not null,
  seq int not null,
  node_id text not null,
  event text not null,
  actor text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (tenant_id, submission_id, seq)
);

create table if not exists storage_profiles (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  kind text not null,
  config jsonb not null,
  secret_name text,
  tested_at timestamptz,
  unique (tenant_id, name)
);

create table if not exists ecm_profiles (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  kind text not null,
  config jsonb not null,
  secret_name text,
  tested_at timestamptz,
  unique (tenant_id, name)
);

create table if not exists webhook_endpoints (
  id text primary key,
  tenant_id text not null references tenants (id),
  url text not null,
  secret_name text not null,
  events jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists webhook_attempts (
  id text primary key,
  tenant_id text not null references tenants (id),
  delivery_id text not null,
  attempt int not null,
  status_code int,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists ai_generations (
  id text primary key,
  tenant_id text not null references tenants (id),
  provider text not null,
  model text not null,
  prompt_version text not null,
  prompt text not null,
  result jsonb,
  form_id text,
  created_at timestamptz not null default now()
);

create table if not exists job_events (
  id text primary key,
  tenant_id text not null references tenants (id),
  job_id text not null,
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists dead_letter_events (
  id text primary key,
  tenant_id text not null references tenants (id),
  source text not null,
  payload jsonb not null,
  reason text not null,
  created_at timestamptz not null default now(),
  retried_at timestamptz
);

create table if not exists feature_flags (
  tenant_id text not null references tenants (id),
  name text not null,
  enabled boolean not null default false,
  primary key (tenant_id, name)
);

create table if not exists analytics_events (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  subject text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_tenant on analytics_events (tenant_id, name);
