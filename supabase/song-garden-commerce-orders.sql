-- Phase C: stub commerce orders (additive).
-- Editions table already exists in song-garden-persistent-world.sql.
-- Run in Supabase SQL Editor when ready.

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

alter table if exists public.garden_orders enable row level security;
