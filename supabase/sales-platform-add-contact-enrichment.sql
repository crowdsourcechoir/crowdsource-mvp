-- Phase 2: contact email enrichment (Apollo.io primary, Hunter.io fallback — see
-- docs/sales-platform/ai-workflow.md §4.5 and lib/sales/enrichment). Adds tracking columns to
-- contacts (so a contact is only ever sent to the paid enrichment API once, never re-billed on
-- every pipeline re-run) and adds the new 'enrich_contact' pipeline stage to agent_runs' stage
-- check constraint. Run this once in the Supabase SQL Editor (sales-platform-tables.sql must
-- already be applied).

alter table if exists public.contacts
  add column if not exists enrichment_attempted_at timestamptz,
  add column if not exists enrichment_provider text check (enrichment_provider in ('apollo', 'hunter')),
  add column if not exists enrichment_status text check (enrichment_status in ('found', 'not_found', 'error'));

create index if not exists contacts_enrichment_attempted_at_idx on public.contacts (enrichment_attempted_at);

-- Widen agent_runs.stage's check constraint to allow 'enrich_contact', regardless of what
-- Postgres auto-named the original inline check constraint.
do $$
declare
  existing_constraint_name text;
begin
  select con.conname into existing_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'agent_runs'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%stage%';

  if existing_constraint_name is not null then
    execute format('alter table public.agent_runs drop constraint %I', existing_constraint_name);
  end if;
end $$;

alter table public.agent_runs add constraint agent_runs_stage_check check (stage in (
  'normalize', 'research', 'detect_opportunity', 'find_contact', 'enrich_contact', 'verify_contact',
  'score', 'brief', 'draft', 'qa', 'queue', 'hubspot_sync'
));
