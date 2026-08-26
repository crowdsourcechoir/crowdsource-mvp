-- Gmail send safety after the 2026-08-15 same-contact multi-send incident.
-- Additive. Run once in the Supabase SQL Editor after sales-platform-add-gmail.sql.
--
-- 1. Pause/resume sending on the connection row (reconnect OAuth does NOT auto-enable).
-- 2. At most one open initial draft per contact so remaining-queue cannot hop to a duplicate.

alter table if exists public.gmail_connections
  add column if not exists sends_enabled boolean not null default false;

comment on column public.gmail_connections.sends_enabled is
  'Operator toggle. Reconnect leaves this false so outbound Gmail stays paused until Resume sending.';

-- Collapse duplicate open initial drafts: keep the oldest, reject the rest.
with ranked as (
  select
    id,
    row_number() over (
      partition by opportunity_id, contact_id
      order by created_at asc, id asc
    ) as rn
  from public.outreach_drafts
  where kind = 'initial'
    and contact_id is not null
    and status in ('draft', 'qa_flagged', 'qa_passed')
)
update public.outreach_drafts d
set status = 'rejected',
    updated_at = now()
from ranked r
where d.id = r.id
  and r.rn > 1;

create unique index if not exists outreach_drafts_one_open_initial_per_contact_idx
  on public.outreach_drafts (opportunity_id, contact_id)
  where kind = 'initial'
    and contact_id is not null
    and status in ('draft', 'qa_flagged', 'qa_passed');
