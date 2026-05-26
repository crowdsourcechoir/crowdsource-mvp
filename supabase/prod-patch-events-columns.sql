-- Production catch-up for public.events (safe to re-run).
-- Supabase → SQL Editor → paste → Run.
-- Fixes: "column events.hero_image_mode does not exist" and related API errors.

alter table public.events
  add column if not exists hero_image_mode text not null default 'bw';
alter table public.events
  add column if not exists landing_headline text not null default 'We''re crowdsourcing a song for this event. Want to help create it?';
alter table public.events
  add column if not exists landing_copy text not null default '';
alter table public.events
  add column if not exists cta_text text not null default 'Let''s make an anthem';
alter table public.events
  add column if not exists anthem_completion_message text not null default 'Thanks! Your answers will help shape the song we''re making.';
alter table public.events
  add column if not exists allow_audio_video_prompt boolean not null default true;
alter table public.events
  add column if not exists song_garden_config jsonb default null;

comment on column public.events.song_garden_config is 'Song Garden journey: transition message + ordered sound step prompts';

-- For agent interview columns (agent_theme_id, agent_brief), run after agent_themes exists:
--   supabase/agent-interview-tables.sql
