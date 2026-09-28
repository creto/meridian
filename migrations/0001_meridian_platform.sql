-- Durable platform state. Applied by PGLite at startup and by scripts/migrate.mjs when DATABASE_URL is set.

create table if not exists tenants (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  tenant_id text not null references tenants (id),
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null,
  disabled boolean not null default false,
  locked boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users (id),
  tenant_id text not null references tenants (id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists api_keys (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  public_id text not null unique,
  secret_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists secret_refs (
  id text primary key,
  tenant_id text not null references tenants (id),
  name text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists workspace_state (
  tenant_id text primary key references tenants (id),
  revision int not null,
  content_hash text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  tenant_id text not null references tenants (id),
  seq bigint not null,
  actor text not null,
  action text not null,
  target text not null,
  detail text,
  prev_hash text not null,
  hash text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, seq)
);

create table if not exists jobs (
  id text primary key,
  tenant_id text not null references tenants (id),
  queue text not null,
  status text not null,
  payload jsonb not null,
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_due on jobs (status, run_at);

create table if not exists webhook_deliveries (
  id text primary key,
  tenant_id text not null references tenants (id),
  endpoint_id text not null,
  event text not null,
  payload jsonb not null,
  status text not null,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists idempotency_records (
  tenant_id text not null references tenants (id),
  key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, key)
);
