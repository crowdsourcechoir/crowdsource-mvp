-- Song Seeds: add Suno-ready prompts (3 ready-to-paste prompts for Suno AI).
-- Run in Supabase SQL editor. Non-destructive.
-- Note: the app also embeds the same prompts inside source_mapping as a backup row
-- (field _sunoPromptsBackup) so prompts still load if this column is missing.

alter table public.song_seeds
  add column if not exists suno_prompts jsonb not null default '[]';

comment on column public.song_seeds.suno_prompts is 'Array of 3 ready-to-paste prompts for Suno song engine, generated from this seed';
