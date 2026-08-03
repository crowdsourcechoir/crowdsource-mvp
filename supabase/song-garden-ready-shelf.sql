-- Phase D: Crowdsource Fans gameday ready shelf (additive).
-- Run in Supabase SQL Editor when ready.

create table if not exists public.garden_ready_shelf (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  title text not null,
  moment_type text not null default 'general',
  zone_key text,
  sponsor_key text,
  source_type text not null default 'manual',
  source_id text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'ready',
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists garden_ready_shelf_garden_sort_idx
  on public.garden_ready_shelf (garden_id, sort_index, created_at desc);

alter table if exists public.garden_ready_shelf enable row level security;
