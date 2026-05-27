-- Production catch-up for public.agent_participants (safe to re-run).
-- Supabase → SQL Editor → paste → Run.
-- Fixes: "Could not find the 'display_name' column of 'agent_participants' in the schema cache"

alter table public.agent_participants
  add column if not exists display_name text default null;

alter table public.agent_participants
  add column if not exists email text default null;

-- Refresh PostgREST schema cache so API sees new columns immediately.
notify pgrst, 'reload schema';
