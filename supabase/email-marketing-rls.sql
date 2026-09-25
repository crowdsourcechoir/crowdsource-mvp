-- Email marketing RLS lock-down.
-- Access is the Next.js service role, which bypasses RLS.
-- Run after supabase/email-marketing-tables.sql.

alter table if exists public.people enable row level security;
alter table if exists public.person_emails enable row level security;
alter table if exists public.person_links enable row level security;
alter table if exists public.person_tags enable row level security;
alter table if exists public.communication_subscriptions enable row level security;
alter table if exists public.subscription_events enable row level security;
alter table if exists public.suppressions enable row level security;
alter table if exists public.email_design_systems enable row level security;
alter table if exists public.email_documents enable row level security;
alter table if exists public.email_document_versions enable row level security;
alter table if exists public.email_templates enable row level security;
alter table if exists public.email_assets enable row level security;
alter table if exists public.segments enable row level security;
alter table if exists public.segment_memberships enable row level security;
alter table if exists public.campaigns enable row level security;
alter table if exists public.campaign_sends enable row level security;
alter table if exists public.email_deliveries enable row level security;
alter table if exists public.email_links enable row level security;
alter table if exists public.email_events enable row level security;
alter table if exists public.email_test_sends enable row level security;
alter table if exists public.marketing_settings enable row level security;
