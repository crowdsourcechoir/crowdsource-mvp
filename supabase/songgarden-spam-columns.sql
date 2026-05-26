-- Run after songgarden-tables.sql to add spam-prevention columns.

alter table public.songgarden_clips
  add column if not exists device_id text not null default '';

alter table public.songgarden_clips
  add column if not exists session_token text;

alter table public.songgarden_clips
  add column if not exists ip_hash text;

create index if not exists idx_songgarden_clips_event_device_submitted
  on public.songgarden_clips(event_id, device_id, submitted_at desc);

create index if not exists idx_songgarden_clips_event_ip_submitted
  on public.songgarden_clips(event_id, ip_hash, submitted_at desc)
  where ip_hash is not null;
