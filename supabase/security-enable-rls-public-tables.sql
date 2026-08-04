-- Security Advisor fix: enable RLS on every public app table.
--
-- Fixes:
--   • rls_disabled_in_public      — "Table publicly accessible"
--   • sensitive_columns_exposed  — "Sensitive data publicly accessible"
--     (email / session_token / phone / etc. on tables reachable via PostgREST)
--
-- Access pattern: Next.js API routes use SUPABASE_SERVICE_ROLE_KEY only
-- (service role bypasses RLS). Enabling RLS with no policies denies
-- anon/authenticated PostgREST access entirely.
--
-- Safe to re-run. Apply in Supabase Dashboard → SQL Editor → Run.
-- After it succeeds, re-check Security Advisor; the two critical cards clear
-- once Advisor refreshes (usually within a minute).

-- ── Core event / interview / prompt-game ───────────────────────────────────

alter table if exists public.events enable row level security;

alter table if exists public.agent_themes enable row level security;
alter table if exists public.agent_participants enable row level security;
alter table if exists public.agent_conversations enable row level security;
alter table if exists public.agent_conversation_turns enable row level security;
alter table if exists public.song_seeds enable row level security;

alter table if exists public.prompt_game_sessions enable row level security;
alter table if exists public.prompt_game_rounds enable row level security;
alter table if exists public.prompt_game_submissions enable row level security;
alter table if exists public.prompt_game_votes enable row level security;
alter table if exists public.prompt_game_ai_outputs enable row level security;

alter table if exists public.event_memory_records enable row level security;

-- ── Songgarden (session_token / ip_hash = sensitive-column lint) ───────────

alter table if exists public.songgarden_clips enable row level security;

-- ── Persistent Song Garden / Fans (if those migrations were applied) ───────

alter table if exists public.gardens enable row level security;
alter table if exists public.garden_chapters enable row level security;
alter table if exists public.garden_mutations enable row level security;
alter table if exists public.garden_participant_marks enable row level security;
alter table if exists public.garden_editions enable row level security;
alter table if exists public.garden_orders enable row level security;
alter table if exists public.garden_ready_shelf enable row level security;

-- ── Sales platform (contacts.email / phone = sensitive-column lint) ────────

alter table if exists public.industry_segments enable row level security;
alter table if exists public.organization_types enable row level security;
alter table if exists public.opportunity_types enable row level security;
alter table if exists public.organizations enable row level security;
alter table if exists public.contacts enable row level security;
alter table if exists public.opportunities enable row level security;
alter table if exists public.pipeline_runs enable row level security;
alter table if exists public.agent_runs enable row level security;
alter table if exists public.research_sources enable row level security;
alter table if exists public.research_findings enable row level security;
alter table if exists public.prospect_scores enable row level security;
alter table if exists public.outreach_templates enable row level security;
alter table if exists public.outreach_drafts enable row level security;
alter table if exists public.approval_queue_items enable row level security;
alter table if exists public.outreach_activities enable row level security;
alter table if exists public.hubspot_sync_records enable row level security;
alter table if exists public.user_preferences enable row level security;
alter table if exists public.discovery_runs enable row level security;
alter table if exists public.digest_runs enable row level security;
