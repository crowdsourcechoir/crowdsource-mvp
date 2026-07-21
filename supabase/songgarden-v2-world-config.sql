-- Song Garden V2: participant-experience "world" configuration.
-- Additive + nullable — safe to re-run. Run once in the Supabase SQL Editor.
-- Does not touch existing songgarden_clips / agent_* / events columns.

alter table public.events
  add column if not exists world_config jsonb default null;

comment on column public.events.world_config is
  'Song Garden V2 world config (title/hero/colors/animation preset/ambient soundtrack overrides). Null = derive defaults from existing event fields at render time.';
