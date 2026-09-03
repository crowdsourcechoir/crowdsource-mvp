-- Direct-to-storage participant audio (bypasses Vercel body limit + Postgres bytea).
-- Legacy clips keep audio_data; new uploads set storage paths and leave audio_data null.

alter table public.songgarden_clips
  add column if not exists audio_storage_path text;

alter table public.songgarden_clips
  add column if not exists audio_original_storage_path text;

alter table public.songgarden_clips
  alter column audio_data drop not null;

comment on column public.songgarden_clips.audio_storage_path is
  'Supabase Storage path for playable audio (preferred over audio_data bytea)';
comment on column public.songgarden_clips.audio_original_storage_path is
  'Storage path for untrimmed original when has_original';

create index if not exists idx_songgarden_clips_event_storage
  on public.songgarden_clips(event_id, submitted_at desc)
  where audio_storage_path is not null;
