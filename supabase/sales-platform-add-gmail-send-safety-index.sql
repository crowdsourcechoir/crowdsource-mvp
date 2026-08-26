-- Optional, not required to reconnect Gmail.
-- The unique-index + duplicate-draft cleanup is what timed out in the SQL Editor.
-- App-level send guards already block same-contact duplicate sends without this index.
--
-- Run only after the one-liner in sales-platform-add-gmail-send-safety.sql succeeds.
-- If this times out, skip it — sending is still safe.

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
