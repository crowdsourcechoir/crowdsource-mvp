-- Song Seeds: add Suno-ready prompts (3 ready-to-paste prompts for Suno AI).
-- Run in Supabase SQL editor. Non-destructive.

alter table public.song_seeds
  add column if not exists suno_prompts jsonb not null default '[]';

comment on column public.song_seeds.suno_prompts is 'Array of 3 ready-to-paste prompts for Suno song engine, generated from this seed';
