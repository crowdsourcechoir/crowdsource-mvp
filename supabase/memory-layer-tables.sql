-- OCTO Layer 4: Memory Layer — event archive records.
-- Run in Supabase SQL Editor after events-table.sql.

create table if not exists public.event_memory_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  payload jsonb not null,
  finalized_at timestamptz not null default now(),
  finalized_by text not null default 'joel' check (finalized_by in ('joel', 'system')),
  version int not null default 1,
  created_at timestamptz default now()
);

comment on table public.event_memory_records is 'Consent-scoped Event Memory Record snapshots (OCTO Memory Layer)';
comment on column public.event_memory_records.payload is 'Full EventMemoryRecord JSON — curated references, not raw duplication';

create index if not exists idx_event_memory_records_event on public.event_memory_records(event_id);
create index if not exists idx_event_memory_records_finalized on public.event_memory_records(finalized_at desc);

alter table if exists public.event_memory_records enable row level security;
