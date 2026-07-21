-- Stage 0: nightly/manual organization discovery (Tavily primary, Serper.dev fallback — see
-- docs/sales-platform/ai-workflow.md "Stage 0" and lib/sales/discovery). Adds a tracking table,
-- sibling to pipeline_runs, for discovery runs — there's no organization row yet when discovery
-- runs, so this is not a pipeline_runs/agent_runs row. Run this once in the Supabase SQL Editor
-- (sales-platform-tables.sql must already be applied). Purely additive; organizations.source
-- already allows 'ai_discovered' from the original schema, so no change needed there.

create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual' check (trigger in ('manual', 'cron')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  provider text check (provider in ('tavily', 'serper')),
  queries jsonb not null default '[]',
  candidates_found int not null default 0,
  candidates_new int not null default 0,
  candidates_duplicate int not null default 0,
  created_organization_ids uuid[] not null default '{}',
  model text,
  tokens_input int,
  tokens_output int,
  cost_usd numeric,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists discovery_runs_created_at_idx on public.discovery_runs (created_at desc);

alter table if exists public.discovery_runs enable row level security;
