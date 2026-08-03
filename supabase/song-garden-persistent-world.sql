-- Song Garden persistent shared world (Phase A).
-- Additive / idempotent. Run in Supabase SQL Editor.
-- Accessed only via Next.js service-role routes (enable RLS; no anon policies).

create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind text not null default 'series',
  status text not null default 'draft',
  brand_kit jsonb not null default '{}'::jsonb,
  world_state jsonb not null default '{}'::jsonb,
  world_version int not null default 0,
  mutation_policy jsonb not null default '{}'::jsonb,
  commerce jsonb default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garden_chapters (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  event_id text not null unique,
  idx int not null,
  label text not null default '',
  opens_at timestamptz,
  closes_at timestamptz,
  chapter_weight double precision not null default 1,
  status text not null default 'upcoming',
  unique (garden_id, idx)
);

create index if not exists garden_chapters_garden_idx
  on public.garden_chapters (garden_id, idx);

create table if not exists public.garden_mutations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  chapter_id uuid references public.garden_chapters(id) on delete set null,
  device_id text,
  kind text not null,
  source_type text not null,
  source_id text not null,
  delta jsonb not null default '{}'::jsonb,
  effects jsonb not null default '[]'::jsonb,
  world_version int not null,
  created_at timestamptz not null default now()
);

create index if not exists garden_mutations_garden_created_idx
  on public.garden_mutations (garden_id, created_at desc);

create table if not exists public.garden_participant_marks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  device_id text not null,
  kind text not null,
  idx int not null,
  source_type text not null,
  source_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists garden_marks_garden_device_idx
  on public.garden_participant_marks (garden_id, device_id);

create table if not exists public.garden_editions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  slug text not null,
  label text not null,
  pinned_snapshot jsonb not null,
  render_seed text not null,
  pinned_at timestamptz not null default now(),
  unique (garden_id, slug)
);

create table if not exists public.garden_orders (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  kind text not null default 'living',
  edition_id uuid references public.garden_editions(id) on delete set null,
  edition_slug text,
  format text not null default 'square_print',
  device_id text,
  ordered_snapshot jsonb not null,
  merch_input jsonb not null,
  status text not null default 'stub',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists garden_orders_garden_created_idx
  on public.garden_orders (garden_id, created_at desc);

alter table if exists public.gardens enable row level security;
alter table if exists public.garden_chapters enable row level security;
alter table if exists public.garden_mutations enable row level security;
alter table if exists public.garden_participant_marks enable row level security;
alter table if exists public.garden_editions enable row level security;
alter table if exists public.garden_orders enable row level security;
