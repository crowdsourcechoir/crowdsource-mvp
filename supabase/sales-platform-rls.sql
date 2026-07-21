-- Sales Platform RLS lock-down — same pattern as supabase/security-enable-rls-public-tables.sql.
-- All access to these tables goes through Next.js API routes using SUPABASE_SERVICE_ROLE_KEY
-- (service role bypasses RLS). Enabling RLS with no policies denies anon/authenticated
-- PostgREST access entirely. Run in the Supabase SQL Editor after sales-platform-tables.sql.

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
