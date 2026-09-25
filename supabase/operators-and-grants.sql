-- People, grants, and one-time invite/reset tokens.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- Service role only: RLS is on and there are no anon policies.

create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists operators_email_lower_idx
  on public.operators (lower(email));

create table if not exists public.operator_grants (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  capability text not null check (capability in ('compose', 'steward', 'sales')),
  scope_type text not null check (scope_type in ('bloom', 'garden', 'sales')),
  scope_id text,
  created_at timestamptz not null default now()
);

create index if not exists operator_grants_operator_idx
  on public.operator_grants (operator_id);

create table if not exists public.operator_tokens (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  token_hash text not null unique,
  purpose text not null check (purpose in ('invite', 'reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;
alter table public.operator_grants enable row level security;
alter table public.operator_tokens enable row level security;
