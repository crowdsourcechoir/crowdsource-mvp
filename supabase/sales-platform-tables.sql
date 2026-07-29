-- Sales Platform (AI-assisted prospecting) — initial schema.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Additive only: does not touch any existing table.
-- See docs/sales-platform/database.md for full rationale.

-- ── Lookup tables (extensible without app/schema changes) ──────────────────

create table if not exists public.industry_segments (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  created_at timestamptz default now()
);

create table if not exists public.organization_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  industry_segment_id uuid references public.industry_segments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.opportunity_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- ── Core entities ────────────────────────────────────────────────────────

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  domain text,
  organization_type_id uuid references public.organization_types(id) on delete set null,
  website_url text,
  location_city text,
  location_region text,
  location_country text,
  estimated_size text,
  source text not null default 'manual' check (source in ('manual', 'csv_import', 'ai_discovered')),
  duplicate_of_organization_id uuid references public.organizations(id) on delete set null,
  is_existing_client boolean not null default false,
  import_metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists organizations_domain_idx on public.organizations (domain);
create index if not exists organizations_normalized_name_idx on public.organizations (normalized_name);
create index if not exists organizations_is_existing_client_idx on public.organizations (is_existing_client);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  role_title text,
  role_category text,
  outreach_persona text
    check (outreach_persona in ('executive_director', 'events_director', 'program_manager', 'board_member', 'conference_planner', 'other')),
  email text,
  normalized_email text,
  phone text,
  email_verification_status text not null default 'unverified'
    check (email_verification_status in ('unverified', 'valid_format', 'verified_deliverable', 'invalid', 'risky')),
  linkedin_url text,
  source text not null default 'manual' check (source in ('ai_discovered', 'manual', 'hubspot_import', 'csv_import')),
  duplicate_of_contact_id uuid references public.contacts(id) on delete set null,
  import_metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contacts_organization_id_idx on public.contacts (organization_id);
create index if not exists contacts_normalized_email_idx on public.contacts (normalized_email);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_type_id uuid references public.opportunity_types(id) on delete set null,
  title text not null,
  event_or_initiative_name text,
  event_date_estimate date,
  event_date_confidence text check (event_date_confidence in ('confirmed', 'estimated', 'unknown')),
  event_website_url text,
  description text,
  status text not null default 'new'
    check (status in ('new', 'researching', 'ready_for_review', 'approved', 'rejected', 'deferred', 'needs_more_research', 'duplicate')),
  target_contact_role_hint text,
  import_metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists opportunities_organization_id_idx on public.opportunities (organization_id);
create index if not exists opportunities_status_idx on public.opportunities (status);

-- ── Pipeline execution ledger ────────────────────────────────────────────

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trigger text not null default 'manual' check (trigger in ('manual', 'cron', 'reprocess_request', 'csv_import')),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'partially_failed')),
  current_stage text,
  started_at timestamptz,
  finished_at timestamptz,
  total_cost_usd numeric,
  created_at timestamptz default now()
);

create index if not exists pipeline_runs_organization_id_idx on public.pipeline_runs (organization_id);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  stage text not null check (stage in (
    'normalize', 'research', 'detect_opportunity', 'find_contact', 'verify_contact',
    'score', 'brief', 'draft', 'qa', 'queue', 'hubspot_sync'
  )),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'retrying', 'skipped')),
  attempt int not null default 1,
  max_attempts int not null default 3,
  input jsonb,
  output jsonb,
  error text,
  model text,
  tokens_input int,
  tokens_output int,
  cost_usd numeric,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists agent_runs_pipeline_run_id_idx on public.agent_runs (pipeline_run_id);
create index if not exists agent_runs_stage_idx on public.agent_runs (stage);

-- ── Research & evidence ──────────────────────────────────────────────────

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  url text not null,
  title text,
  fetched_at timestamptz not null default now(),
  content_hash text,
  raw_excerpt text,
  retrieval_status text not null default 'ok' check (retrieval_status in ('ok', 'blocked', 'error', 'paywalled', 'imported')),
  created_at timestamptz default now()
);

create index if not exists research_sources_pipeline_run_id_idx on public.research_sources (pipeline_run_id);

create table if not exists public.research_findings (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  source_id uuid not null references public.research_sources(id) on delete cascade,
  claim_type text not null,
  claim_text text not null,
  claim_value jsonb,
  confidence numeric,
  origin text not null default 'ai_research' check (origin in ('ai_research', 'human_provided')),
  created_at timestamptz default now()
);

create index if not exists research_findings_organization_id_idx on public.research_findings (organization_id);
create index if not exists research_findings_opportunity_id_idx on public.research_findings (opportunity_id);

-- ── Scoring ───────────────────────────────────────────────────────────────

create table if not exists public.prospect_scores (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  total_score numeric not null,
  component_scores jsonb not null,
  rationale text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  missing_information text[] not null default '{}',
  model text,
  created_at timestamptz default now()
);

create index if not exists prospect_scores_opportunity_id_idx on public.prospect_scores (opportunity_id);

-- ── Outreach ──────────────────────────────────────────────────────────────

create table if not exists public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_type_id uuid references public.opportunity_types(id) on delete set null,
  body_template text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  template_id uuid references public.outreach_templates(id) on delete set null,
  ai_subject text not null,
  ai_body text not null,
  edited_subject text,
  edited_body text,
  qa_flags jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'qa_passed', 'qa_flagged', 'approved', 'approved_with_edits', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists outreach_drafts_opportunity_id_idx on public.outreach_drafts (opportunity_id);

-- ── Approval queue ────────────────────────────────────────────────────────

create table if not exists public.approval_queue_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  outreach_draft_id uuid references public.outreach_drafts(id) on delete set null,
  prospect_score_id uuid references public.prospect_scores(id) on delete set null,
  duplicate_warning boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'approved_with_edits', 'rejected', 'deferred', 'needs_more_research', 'duplicate')),
  decision_notes text,
  decided_by text,
  decided_at timestamptz,
  deferred_until timestamptz,
  created_at timestamptz default now()
);

create index if not exists approval_queue_items_status_idx on public.approval_queue_items (status);

-- ── Activity & sync ───────────────────────────────────────────────────────

create table if not exists public.outreach_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  activity_type text not null check (activity_type in ('approved', 'sent', 'opened', 'replied', 'bounced', 'follow_up_due', 'note')),
  occurred_at timestamptz not null default now(),
  metadata jsonb,
  hubspot_activity_id text
);

create index if not exists outreach_activities_opportunity_id_idx on public.outreach_activities (opportunity_id);

create table if not exists public.hubspot_sync_records (
  id uuid primary key default gen_random_uuid(),
  local_entity_type text not null check (local_entity_type in ('organization', 'contact', 'opportunity')),
  local_entity_id uuid not null,
  hubspot_object_type text not null check (hubspot_object_type in ('company', 'contact', 'note', 'deal')),
  hubspot_object_id text,
  status text not null default 'pending' check (status in ('pending', 'synced', 'error')),
  last_synced_at timestamptz,
  last_error text,
  payload_hash text
);

create unique index if not exists hubspot_sync_records_entity_idx
  on public.hubspot_sync_records (local_entity_type, local_entity_id, hubspot_object_type);

-- ── Preferences ───────────────────────────────────────────────────────────

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null unique default 'default',
  daily_approval_target int not null default 40,
  scoring_weight_overrides jsonb,
  muted_organization_type_ids uuid[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Seed data ─────────────────────────────────────────────────────────────

insert into public.industry_segments (key, label) values
  ('education', 'Education'),
  ('sports_entertainment', 'Sports & Entertainment'),
  ('corporate', 'Corporate'),
  ('nonprofit_community', 'Nonprofit & Community'),
  ('tech_innovation', 'Tech & Innovation'),
  ('healthcare', 'Healthcare'),
  ('marketing_events_travel', 'Marketing, Events & Travel'),
  ('associations_leadership', 'Associations & Leadership')
on conflict (key) do nothing;

insert into public.organization_types (key, label, industry_segment_id) values
  ('conference', 'Conference', null),
  ('association', 'Association', (select id from public.industry_segments where key = 'associations_leadership')),
  ('corporation', 'Corporation', (select id from public.industry_segments where key = 'corporate')),
  ('sports_team', 'Sports Team', (select id from public.industry_segments where key = 'sports_entertainment')),
  ('sports_league', 'Sports League', (select id from public.industry_segments where key = 'sports_entertainment')),
  ('university', 'University', (select id from public.industry_segments where key = 'education')),
  ('school', 'School', (select id from public.industry_segments where key = 'education')),
  ('nonprofit', 'Nonprofit', (select id from public.industry_segments where key = 'nonprofit_community')),
  ('festival', 'Festival', (select id from public.industry_segments where key = 'nonprofit_community')),
  ('venue', 'Venue', null),
  ('event_agency', 'Event Agency', (select id from public.industry_segments where key = 'marketing_events_travel')),
  ('destination_marketing_organization', 'Destination Marketing Organization', (select id from public.industry_segments where key = 'marketing_events_travel')),
  ('other', 'Other', null)
on conflict (key) do nothing;

insert into public.opportunity_types (key, label) values
  ('annual_conference', 'Annual Conference'),
  ('employee_gathering', 'Employee Gathering'),
  ('fan_engagement_initiative', 'Fan Engagement Initiative'),
  ('team_season_launch', 'Team Season Launch'),
  ('university_orientation', 'University Orientation'),
  ('fundraising_gala', 'Fundraising Gala'),
  ('leadership_retreat', 'Leadership Retreat'),
  ('community_festival', 'Community Festival'),
  ('association_convention', 'Association Convention'),
  ('other', 'Other')
on conflict (key) do nothing;

-- One approved, general-purpose template so the drafting stage has something
-- to use in v1 without a template-management UI. Refine/replace via SQL for now.
insert into public.outreach_templates (name, opportunity_type_id, body_template, status)
select
  'General purpose — v1 default',
  null,
  E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\n{{fit_reason}}\n\nI''ve included a bit more about the experience here:\n{{book_url}}\n\n{{cta}}\n\nThanks, and I hope we have a chance to connect.\n\nBest,\nJoel',
  'approved'
where not exists (
  select 1 from public.outreach_templates where name = 'General purpose — v1 default'
);
