-- Morning email digest of newly ready-for-review opportunities (see docs/sales-platform/roadmap.md
-- and ai-workflow.md). Tracking table, sibling to discovery_runs/pipeline_runs — one row per
-- digest send attempt, so the digest cron knows the cutoff timestamp for "new since last digest"
-- and so a failed send is visible/auditable like every other run type in this system. Run this
-- once in the Supabase SQL Editor (sales-platform-tables.sql must already be applied). Purely
-- additive.

create table if not exists public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'cron' check (trigger in ('manual', 'cron')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped_no_provider', 'deferred')),
  item_count int not null default 0,
  recipient text,
  provider_message_id text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists digest_runs_created_at_idx on public.digest_runs (created_at desc);

alter table if exists public.digest_runs enable row level security;
