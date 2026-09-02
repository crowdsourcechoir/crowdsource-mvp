-- Platform V2 community spine (Garden Agent).
-- Additive / idempotent. Run in Supabase SQL Editor after song-garden-persistent-world.sql.
-- Accessed only via Next.js service-role routes.

-- Community settings on the Garden (identity mode, Index audience, Populus pilot).
alter table public.gardens
  add column if not exists community jsonb not null default '{}'::jsonb;

-- Device ↔ claimed identity (open = optional; account_required = must claim).
create table if not exists public.garden_participant_identities (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  device_id text not null,
  display_name text,
  email text,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garden_id, device_id)
);

create index if not exists garden_identities_garden_idx
  on public.garden_participant_identities (garden_id);

-- Contribution graph nodes — discoverable culture with required rights.
create table if not exists public.garden_contribution_nodes (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  chapter_id uuid references public.garden_chapters(id) on delete set null,
  bloom_event_id text,
  device_id text,
  source_type text not null,
  source_id text not null,
  kind text not null default 'other',
  rights jsonb not null default '{}'::jsonb,
  selected boolean not null default false,
  performed boolean not null default false,
  credit_name text,
  excerpt text,
  react_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garden_id, source_type, source_id)
);

create index if not exists garden_contrib_nodes_garden_selected_idx
  on public.garden_contribution_nodes (garden_id, selected, created_at desc);

create index if not exists garden_contrib_nodes_garden_created_idx
  on public.garden_contribution_nodes (garden_id, created_at desc);

-- React primitive (heart only in v0).
create table if not exists public.garden_contribution_reacts (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  device_id text not null,
  reaction text not null default 'heart',
  created_at timestamptz not null default now(),
  unique (garden_id, source_type, source_id, device_id)
);

create index if not exists garden_contrib_reacts_garden_created_idx
  on public.garden_contribution_reacts (garden_id, created_at desc);

-- Recognition emits: selected (Composer) / performed (Live) / amplified (React).
create table if not exists public.garden_recognition_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  kind text not null,
  source_type text not null,
  source_id text not null,
  actor_device_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists garden_recognition_garden_created_idx
  on public.garden_recognition_events (garden_id, created_at desc);

create index if not exists garden_recognition_source_idx
  on public.garden_recognition_events (garden_id, source_type, source_id);

alter table public.garden_participant_identities enable row level security;
alter table public.garden_contribution_nodes enable row level security;
alter table public.garden_contribution_reacts enable row level security;
alter table public.garden_recognition_events enable row level security;
