-- Song Garden V1 submissions and performance asset review.
-- Safe to run more than once in Supabase SQL Editor.

create table if not exists public.song_garden_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_slug text not null,
  participant_name text,
  prompt_id text not null,
  prompt_title text not null,
  sound_type text not null,
  asset_category text not null,
  pitch text,
  midi_note integer,
  consent_status boolean not null default false,
  text_response text,
  raw_audio_url text,
  processed_audio_url text,
  status text not null default 'needs_review',
  created_at timestamptz not null default now(),
  constraint song_garden_submissions_status_check
    check (status in ('needs_review', 'approved', 'rejected'))
);

create index if not exists song_garden_submissions_event_id_idx
  on public.song_garden_submissions (event_id, created_at);

create index if not exists song_garden_submissions_status_idx
  on public.song_garden_submissions (status);
