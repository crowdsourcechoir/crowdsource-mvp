-- Optional SQL mirror for Google Calendar meetings.
-- The live app currently persists the sync window to Supabase Storage
-- (google-calendar/events-v1.json) so Calendar works without this migration.
-- Run this later if you want queryable rows / SQL joins instead of the JSON store.

create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null default 'default',
  google_event_id text not null,
  calendar_id text not null default 'primary',
  status text not null default 'confirmed',
  summary text not null default '',
  description text,
  location text,
  html_link text,
  hangout_link text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  organizer_email text,
  attendee_emails text[] not null default '{}',
  contact_id uuid references public.contacts(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  match_status text not null default 'unmatched'
    check (match_status in ('matched', 'unmatched', 'self_only')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_key, google_event_id)
);

create index if not exists google_calendar_events_start_at_idx
  on public.google_calendar_events (start_at);

create index if not exists google_calendar_events_contact_id_idx
  on public.google_calendar_events (contact_id)
  where contact_id is not null;

create index if not exists google_calendar_events_opportunity_id_idx
  on public.google_calendar_events (opportunity_id)
  where opportunity_id is not null;

alter table if exists public.google_calendar_events enable row level security;
