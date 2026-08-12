-- Lets Joel discard junk organizations so they never enter (or re-enter) the
-- unprocessed pool / pipeline. Distinct from is_existing_client (real customers).
-- Run once in the Supabase SQL Editor.

alter table if exists public.organizations
  add column if not exists discarded_at timestamptz;

create index if not exists organizations_discarded_at_idx
  on public.organizations (discarded_at)
  where discarded_at is not null;
