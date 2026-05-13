-- Security Advisor: enable RLS on public tables that are only accessed via
-- Next.js API routes using SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).
-- Anon/authenticated PostgREST access is denied until you add explicit policies.
-- Run in Supabase SQL Editor (or your migration pipeline) when ready.

alter table if exists public.prompt_game_sessions enable row level security;
alter table if exists public.prompt_game_rounds enable row level security;
alter table if exists public.prompt_game_submissions enable row level security;
alter table if exists public.prompt_game_votes enable row level security;
alter table if exists public.prompt_game_ai_outputs enable row level security;

alter table if exists public.agent_conversation_turns enable row level security;
alter table if exists public.agent_themes enable row level security;
alter table if exists public.agent_participants enable row level security;
alter table if exists public.agent_conversations enable row level security;
alter table if exists public.song_seeds enable row level security;
