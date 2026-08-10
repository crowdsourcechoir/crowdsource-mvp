-- Gmail 1:1 sales assistant: OAuth connection, send/reply tracking, nudge drafts, learning feedback.
-- Purely additive (plus one constraint relaxation). Run once in the Supabase SQL Editor after
-- sales-platform-tables.sql and sales-platform-add-funnel-stage.sql.

-- ── Gmail OAuth connection (single operator) ──────────────────────────────

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null unique default 'default',
  email text not null,
  refresh_token_encrypted text not null,
  history_id text,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.gmail_connections enable row level security;

-- ── Opportunity touch timestamps for nudge scheduling ─────────────────────

alter table if exists public.opportunities
  add column if not exists last_outbound_at timestamptz;

alter table if exists public.opportunities
  add column if not exists last_inbound_at timestamptz;

alter table if exists public.opportunities
  add column if not exists next_follow_up_at timestamptz;

alter table if exists public.opportunities
  add column if not exists gmail_thread_id text;

create index if not exists opportunities_next_follow_up_at_idx
  on public.opportunities (next_follow_up_at)
  where next_follow_up_at is not null;

create index if not exists opportunities_gmail_thread_id_idx
  on public.opportunities (gmail_thread_id)
  where gmail_thread_id is not null;

-- ── Activity Gmail IDs ────────────────────────────────────────────────────

alter table if exists public.outreach_activities
  add column if not exists gmail_message_id text;

alter table if exists public.outreach_activities
  add column if not exists gmail_thread_id text;

create index if not exists outreach_activities_gmail_thread_id_idx
  on public.outreach_activities (gmail_thread_id)
  where gmail_thread_id is not null;

create unique index if not exists outreach_activities_gmail_message_id_uidx
  on public.outreach_activities (gmail_message_id)
  where gmail_message_id is not null;

-- Allow send_failed for fail-closed send attempts that we still want to log if we ever flip policy.
do $$
begin
  alter table public.outreach_activities drop constraint if exists outreach_activities_activity_type_check;
exception
  when undefined_object then null;
end $$;

alter table public.outreach_activities
  add constraint outreach_activities_activity_type_check
  check (activity_type in ('approved', 'sent', 'opened', 'replied', 'bounced', 'follow_up_due', 'note', 'send_failed'));

-- ── Draft kind + nullable pipeline_run for nudge drafts ───────────────────

alter table if exists public.outreach_drafts
  add column if not exists kind text not null default 'initial'
    check (kind in ('initial', 'nudge'));

alter table if exists public.outreach_drafts
  add column if not exists confidence_score numeric;

alter table if exists public.outreach_drafts
  alter column pipeline_run_id drop not null;

-- ── Queue: allow nudge items alongside the initial per-opportunity row ────

alter table if exists public.approval_queue_items
  add column if not exists kind text not null default 'initial'
    check (kind in ('initial', 'nudge'));

do $$
begin
  alter table public.approval_queue_items drop constraint if exists approval_queue_items_opportunity_id_key;
exception
  when undefined_object then null;
end $$;

-- One initial queue row per opportunity (pipeline upsert target).
create unique index if not exists approval_queue_items_one_initial_idx
  on public.approval_queue_items (opportunity_id)
  where kind = 'initial';

-- At most one pending nudge per opportunity.
create unique index if not exists approval_queue_items_one_pending_nudge_idx
  on public.approval_queue_items (opportunity_id)
  where kind = 'nudge' and status = 'pending';

create index if not exists approval_queue_items_kind_status_idx
  on public.approval_queue_items (kind, status);

-- ── Learning feedback from approve-with-edits / reject ────────────────────

create table if not exists public.outreach_feedback (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  outreach_draft_id uuid references public.outreach_drafts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_type_id uuid references public.opportunity_types(id) on delete set null,
  industry_segment_id uuid references public.industry_segments(id) on delete set null,
  outreach_persona text,
  decision text not null check (decision in ('approved_with_edits', 'rejected')),
  original_subject text not null,
  original_body text not null,
  edited_subject text,
  edited_body text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists outreach_feedback_persona_segment_idx
  on public.outreach_feedback (outreach_persona, industry_segment_id, created_at desc);

alter table if exists public.outreach_feedback enable row level security;
