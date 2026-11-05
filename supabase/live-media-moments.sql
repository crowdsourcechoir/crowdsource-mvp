-- Live Room Journey P0 — selfie + snap media on prompt-game sessions.
-- Run in Supabase SQL Editor after deploy (Dashboard → SQL Editor).

-- Host stage policy: auto-show (default) or approve-first.
alter table public.prompt_game_sessions
  add column if not exists display_mode text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prompt_game_sessions_display_mode_check'
  ) then
    alter table public.prompt_game_sessions
      add constraint prompt_game_sessions_display_mode_check
      check (display_mode in ('auto', 'approve_first'));
  end if;
end $$;

-- Media fields on submissions (text rounds leave these null).
alter table public.prompt_game_submissions
  add column if not exists media_type text,
  add column if not exists media_url text,
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_duration_ms int,
  add column if not exists approved boolean not null default false,
  add column if not exists garden_clip_id uuid,
  add column if not exists live_consent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prompt_game_submissions_media_type_check'
  ) then
    alter table public.prompt_game_submissions
      add constraint prompt_game_submissions_media_type_check
      check (media_type is null or media_type in ('photo', 'sound', 'video'));
  end if;
end $$;

create index if not exists idx_prompt_game_submissions_media_round
  on public.prompt_game_submissions(session_id, round_id)
  where media_type is not null;
