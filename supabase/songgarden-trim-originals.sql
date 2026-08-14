-- Song Garden: keep untrimmed originals; playable audio_data is silence-trimmed on new uploads.

alter table public.songgarden_clips
  add column if not exists audio_data_original bytea;

alter table public.songgarden_clips
  add column if not exists trim_lead_ms integer;

alter table public.songgarden_clips
  add column if not exists trim_trail_ms integer;

alter table public.songgarden_clips
  add column if not exists trim_status text not null default 'none';

alter table public.songgarden_clips
  add column if not exists has_original boolean not null default false;

comment on column public.songgarden_clips.audio_data is 'Playable WAV (silence-trimmed on new uploads when possible)';
comment on column public.songgarden_clips.audio_data_original is 'Untrimmed WAV for audition / restore; null on legacy clips';
comment on column public.songgarden_clips.trim_status is 'none | trimmed | skipped';
comment on column public.songgarden_clips.has_original is 'True when audio_data_original is stored';
