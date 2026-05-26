-- Songgarden: pre-show audio clip submissions for drag-and-drop composition workflows.

create table if not exists public.songgarden_clips (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  contributor_name text,
  label text,
  category text not null check (category in ('ambient', 'foley', 'percussion', 'vocal', 'texture', 'other')),
  filename text not null,
  mime_type text not null default 'audio/wav',
  duration_ms integer,
  audio_data bytea not null,
  device_id text not null default '',
  session_token text,
  ip_hash text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_songgarden_clips_event_submitted
  on public.songgarden_clips(event_id, submitted_at desc);

create index if not exists idx_songgarden_clips_event_device_submitted
  on public.songgarden_clips(event_id, device_id, submitted_at desc);

comment on table public.songgarden_clips is 'Pre-show audio samples dropped into the Songgarden canvas';
