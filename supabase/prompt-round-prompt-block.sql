-- Add modular prompt metadata for Signal (and future modes). Run in Supabase SQL Editor if not already applied.

alter table public.prompt_game_rounds
  add column if not exists prompt_block jsonb;

comment on column public.prompt_game_rounds.prompt_block is
  'Optional structured prompt (e.g. Signal collective choice + Ableton trigger stubs).';
