-- Soft-lost / parked: the deal stays on file, leaves the active funnel, and waits
-- for a calendar check-in instead of an automated email.
--
-- Purely additive. Run once in the Supabase SQL Editor. Until this runs, Park & remind
-- still stores the check-in on import_metadata and the app treats that as parked.

alter table public.opportunities drop constraint if exists opportunities_relationship_stage_check;

alter table public.opportunities
  add constraint opportunities_relationship_stage_check
  check (relationship_stage in ('awareness', 'interest', 'purchase', 'lost', 'parked'));
