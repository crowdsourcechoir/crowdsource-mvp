-- Unblock /admin/events when list queries time out.
-- Cause: multi-MB data-URI heroes (and oversized JSON) in public.events.
-- Safe to re-run. Supabase → SQL Editor → paste → Run.

-- Drop inline data-URI heroes. Hosted URLs are kept. Journey/edit can re-upload.
update public.events
set hero_image = ''
where hero_image like 'data:%';

create index if not exists events_date_idx on public.events (date);
