-- Octo email marketing foundation (phase 1).
-- Additive. Does not alter sales contacts, Gardens, or Blooms.
-- Run this file in the Supabase SQL Editor, then supabase/email-marketing-rls.sql.
--
-- History tables reject UPDATE and DELETE (service role bypasses RLS, not triggers).
-- Expected trigger failure:
--   update public.email_document_versions set html = html where false;
--   -- ERROR: email history is insert-only

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  display_name text,
  first_name text,
  last_name text,
  city text,
  region text,
  country text,
  attributes jsonb not null default '{}'::jsonb,
  acquisition_source text not null default 'manual'
    check (acquisition_source in (
      'mailchimp', 'squarespace', 'facebook', 'manual', 'import',
      'song_garden', 'event', 'sales_link', 'other'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_city_idx on public.people (city) where city is not null;
create index if not exists people_acquisition_source_idx on public.people (acquisition_source);
create index if not exists people_created_at_idx on public.people (created_at desc);

create table if not exists public.person_emails (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  email text not null,
  normalized_email text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists person_emails_one_primary_idx
  on public.person_emails (person_id) where is_primary;

create table if not exists public.person_links (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  kind text not null check (kind in ('sales_contact', 'agent_participant')),
  external_id uuid not null,
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create index if not exists person_links_person_kind_idx on public.person_links (person_id, kind);

create table if not exists public.person_tags (
  person_id uuid not null references public.people (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (person_id, tag)
);

create index if not exists person_tags_tag_idx on public.person_tags (tag);

create table if not exists public.communication_subscriptions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  channel text not null check (channel in ('email')),
  topic text not null check (topic in ('marketing')),
  status text not null check (status in ('subscribed', 'unsubscribed', 'pending')),
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (person_id, channel, topic)
);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  subscription_id uuid references public.communication_subscriptions (id) on delete set null,
  event_type text not null check (event_type in (
    'subscribed', 'unsubscribed', 'resubscribed', 'imported', 'pending', 'suppression_lifted'
  )),
  source text not null check (source in (
    'mailchimp_import', 'squarespace', 'facebook', 'admin',
    'unsubscribe_link', 'complaint', 'hard_bounce', 'api'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_person_idx
  on public.subscription_events (person_id, created_at desc);

create table if not exists public.suppressions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people (id) on delete set null,
  normalized_email text not null,
  scope text not null check (scope in ('marketing', 'all_email')),
  reason text not null check (reason in ('unsubscribe', 'hard_bounce', 'complaint', 'manual')),
  source text not null check (source in ('octo', 'resend', 'mailchimp')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);

create unique index if not exists suppressions_active_unique_idx
  on public.suppressions (normalized_email, scope, reason) where active;
create index if not exists suppressions_active_email_idx
  on public.suppressions (normalized_email) where active;

create or replace function public.email_marketing_eligible(p_person_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.people p
    join public.communication_subscriptions s
      on s.person_id = p.id
     and s.channel = 'email'
     and s.topic = 'marketing'
     and s.status = 'subscribed'
    where p.id = p_person_id
      and not exists (
        select 1
        from public.suppressions sup
        where sup.active
          and sup.normalized_email = p.normalized_email
          and sup.scope in ('marketing', 'all_email')
      )
  );
$$;

create or replace function public.marketing_audience_totals()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'all', (select count(*)::int from public.people),
    'subscribed', (
      select count(*)::int from public.people p where public.email_marketing_eligible(p.id)
    ),
    'cleaned', (
      select count(distinct p.id)::int
      from public.people p
      join public.suppressions s
        on s.normalized_email = p.normalized_email
       and s.active
       and s.reason = 'hard_bounce'
    ),
    'unsubscribed', (
      select count(*)::int
      from public.people p
      where not exists (
        select 1 from public.suppressions s
        where s.normalized_email = p.normalized_email
          and s.active
          and s.reason = 'hard_bounce'
      )
      and (
        exists (
          select 1 from public.communication_subscriptions sub
          where sub.person_id = p.id
            and sub.channel = 'email'
            and sub.topic = 'marketing'
            and sub.status = 'unsubscribed'
        )
        or exists (
          select 1 from public.suppressions s
          where s.normalized_email = p.normalized_email
            and s.active
            and s.reason in ('unsubscribe', 'complaint', 'manual')
        )
      )
    )
  );
$$;

create table if not exists public.email_design_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  tokens jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_design_systems_one_default_idx
  on public.email_design_systems (is_default) where is_default;

create table if not exists public.email_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('campaign', 'template')),
  design_system_id uuid not null references public.email_design_systems (id),
  working_document jsonb not null,
  schema_version int not null check (schema_version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.email_documents (id) on delete restrict,
  version_number int not null,
  document jsonb not null,
  mjml text not null,
  html text not null,
  text_plain text not null,
  renderer_version text not null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  document_id uuid not null references public.email_documents (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  public_url text not null,
  alt text not null default '',
  width int,
  height int,
  content_type text not null,
  byte_size int not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind text not null default 'dynamic' check (kind in ('dynamic', 'static')),
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.segment_memberships (
  segment_id uuid not null references public.segments (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, person_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  document_id uuid not null references public.email_documents (id) on delete restrict,
  source_campaign_id uuid references public.campaigns (id) on delete set null,
  source_send_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns (status);
create index if not exists campaigns_source_send_idx on public.campaigns (source_send_id);

create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  status text not null default 'draft' check (status in (
    'draft', 'ready', 'scheduled', 'sending', 'sent', 'partially_failed', 'failed', 'cancelled'
  )),
  subject text not null default '',
  preview_text text not null default '',
  from_name text,
  from_email text,
  reply_to text,
  segment_id uuid references public.segments (id) on delete set null,
  audience_definition jsonb,
  document_version_id uuid references public.email_document_versions (id),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_sends_status_schedule_idx
  on public.campaign_sends (status, scheduled_for);
create index if not exists campaign_sends_campaign_idx on public.campaign_sends (campaign_id);

alter table public.campaigns
  drop constraint if exists campaigns_source_send_fk;
alter table public.campaigns
  add constraint campaigns_source_send_fk
  foreign key (source_send_id) references public.campaign_sends (id) on delete set null;

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_send_id uuid not null references public.campaign_sends (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  to_email text not null,
  status text not null default 'queued' check (status in (
    'queued', 'sending', 'sent', 'delivered', 'delayed', 'failed',
    'bounced', 'complained', 'suppressed', 'cancelled'
  )),
  provider text not null default 'resend',
  provider_message_id text,
  claim_token uuid,
  claimed_at timestamptz,
  attempt_count int not null default 0,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  recorded_open_count int not null default 0,
  first_recorded_open_at timestamptz,
  last_recorded_open_at timestamptz,
  click_count int not null default 0,
  first_click_at timestamptz,
  last_click_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_send_id, person_id)
);

create unique index if not exists email_deliveries_provider_message_idx
  on public.email_deliveries (provider, provider_message_id)
  where provider_message_id is not null;
create index if not exists email_deliveries_send_status_idx
  on public.email_deliveries (campaign_send_id, status);
create index if not exists email_deliveries_provider_message_lookup_idx
  on public.email_deliveries (provider_message_id);

create table if not exists public.email_links (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.email_document_versions (id) on delete restrict,
  section_id text not null,
  href text not null,
  label text,
  unique (document_version_id, section_id, href)
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.email_deliveries (id) on delete set null,
  campaign_send_id uuid references public.campaign_sends (id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null check (event_type in (
    'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained',
    'opened', 'clicked', 'unsubscribed', 'failed', 'unknown'
  )),
  occurred_at timestamptz not null default now(),
  link_id uuid references public.email_links (id) on delete set null,
  url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists email_events_delivery_type_idx on public.email_events (delivery_id, event_type);
create index if not exists email_events_provider_message_idx on public.email_events (provider_message_id);
create index if not exists email_events_send_type_idx on public.email_events (campaign_send_id, event_type);

create table if not exists public.email_test_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  document_version_id uuid not null references public.email_document_versions (id) on delete restrict,
  to_email text not null,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  sends_enabled boolean not null default false,
  from_name text not null default 'Crowdsource Choir',
  from_email text not null default '',
  reply_to text,
  physical_address text not null default '',
  company_name text not null default 'Crowdsource Choir',
  ingest_secret text,
  updated_at timestamptz not null default now()
);

create or replace function public.email_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'email history is insert-only';
end;
$$;

drop trigger if exists email_document_versions_immutable on public.email_document_versions;
create trigger email_document_versions_immutable
  before update or delete on public.email_document_versions
  for each row execute function public.email_reject_mutation();

drop trigger if exists subscription_events_immutable on public.subscription_events;
create trigger subscription_events_immutable
  before update or delete on public.subscription_events
  for each row execute function public.email_reject_mutation();

drop trigger if exists email_events_immutable on public.email_events;
create trigger email_events_immutable
  before update or delete on public.email_events
  for each row execute function public.email_reject_mutation();

-- Phase 1 segment counts. Flat match=all only.
-- Attribute eq, tag has/eq, subscription status. Other types raise.
create or replace function public.marketing_segment_counts(p_definition jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  match_mode text;
  cond jsonb;
  clauses text[] := array[]::text[];
  field text;
  op text;
  val text;
  topic text;
  status text;
  matched int;
  sendable int;
  base_sql text;
begin
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then
    raise exception 'segment definition must be an object';
  end if;
  match_mode := coalesce(p_definition->>'match', '');
  if match_mode <> 'all' then
    raise exception 'segment match % is not supported', match_mode;
  end if;
  if jsonb_typeof(p_definition->'conditions') <> 'array' then
    raise exception 'segment conditions must be an array';
  end if;
  if jsonb_array_length(p_definition->'conditions') = 0 then
    return jsonb_build_object('matched', 0, 'sendable', 0);
  end if;

  for cond in select value from jsonb_array_elements(p_definition->'conditions')
  loop
    if cond->>'type' = 'attribute' then
      field := cond->>'field';
      op := coalesce(cond->>'op', '');
      val := cond->>'value';
      if field not in ('city', 'region', 'country', 'acquisition_source') then
        raise exception 'unsupported attribute %', field;
      end if;
      if op <> 'eq' then
        raise exception 'unsupported op %', op;
      end if;
      if val is null then
        raise exception 'attribute value is required';
      end if;
      clauses := clauses || format('lower(coalesce(p.%I, '''')) = lower(%L)', field, val);
    elsif cond->>'type' = 'tag' then
      op := coalesce(cond->>'op', '');
      val := cond->>'value';
      if op not in ('has', 'eq') then
        raise exception 'unsupported op %', op;
      end if;
      if val is null or length(trim(val)) = 0 then
        raise exception 'tag value is required';
      end if;
      clauses := clauses || format(
        'exists (select 1 from public.person_tags t where t.person_id = p.id and t.tag = lower(%L))',
        val
      );
    elsif cond->>'type' = 'subscription' then
      topic := coalesce(nullif(cond->>'topic', ''), 'marketing');
      status := cond->>'status';
      if topic <> 'marketing' then
        raise exception 'unsupported topic %', topic;
      end if;
      if status not in ('subscribed', 'unsubscribed', 'pending') then
        raise exception 'unsupported subscription status %', coalesce(status, '');
      end if;
      clauses := clauses || format(
        'exists (select 1 from public.communication_subscriptions s where s.person_id = p.id and s.channel = ''email'' and s.topic = ''marketing'' and s.status = %L)',
        status
      );
    else
      raise exception 'unsupported condition type %', coalesce(cond->>'type', '');
    end if;
  end loop;

  base_sql := 'select count(*)::int from public.people p where ' || array_to_string(clauses, ' and ');
  execute base_sql into matched;
  execute base_sql || ' and public.email_marketing_eligible(p.id)' into sendable;
  return jsonb_build_object('matched', coalesce(matched, 0), 'sendable', coalesce(sendable, 0));
end;
$$;

insert into public.email_design_systems (name, is_default, tokens)
select
  'Default',
  true,
  $tokens${
    "schemaVersion": 1,
    "emailWidth": 600,
    "contentWidth": 560,
    "fonts": {
      "heading": "'Bebas Neue', Impact, 'Arial Narrow', sans-serif",
      "body": "'Space Mono', 'Courier New', Courier, monospace",
      "ui": "'Space Mono', 'Courier New', Courier, monospace"
    },
    "colors": {
      "canvas": "#000000",
      "surface": "#111111",
      "ink": "#ffffff",
      "muted": "#a1a1aa",
      "brand": "#CFFF81",
      "brandInk": "#000000",
      "link": "#CFFF81"
    },
    "spacing": { "small": 16, "medium": 32, "large": 48, "xl": 72 }
  }$tokens$::jsonb
where not exists (select 1 from public.email_design_systems where is_default);

insert into public.marketing_settings (singleton, sends_enabled, from_name, company_name)
values (true, false, 'Crowdsource Choir', 'Crowdsource Choir')
on conflict (singleton) do nothing;

revoke all on function public.email_marketing_eligible(uuid) from public;
revoke all on function public.marketing_audience_totals() from public;
revoke all on function public.marketing_segment_counts(jsonb) from public;
grant execute on function public.email_marketing_eligible(uuid) to service_role;
grant execute on function public.marketing_audience_totals() to service_role;
grant execute on function public.marketing_segment_counts(jsonb) to service_role;
