-- Widens opportunities.status's check constraint to allow 'awaiting_contact' — a new status for
-- an opportunity that scored/briefed successfully but has no contact clearing the verified-email
-- bar (`valid_format`/`verified_deliverable`, see lib/sales/dedupe.ts#hasVerifiedEmail) yet, so it
-- is deliberately kept out of the human approval queue instead of forcing a human to do the
-- contact research the pipeline exists to do. See docs/sales-platform/ai-workflow.md §4/§10 and
-- database.md's opportunities.status row. Run this once in the Supabase SQL Editor
-- (sales-platform-tables.sql must already be applied).

do $$
declare
  existing_constraint_name text;
begin
  select con.conname into existing_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'opportunities'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if existing_constraint_name is not null then
    execute format('alter table public.opportunities drop constraint %I', existing_constraint_name);
  end if;
end $$;

alter table public.opportunities add constraint opportunities_status_check check (status in (
  'new', 'researching', 'awaiting_contact', 'ready_for_review', 'approved', 'rejected', 'deferred',
  'needs_more_research', 'duplicate'
));
