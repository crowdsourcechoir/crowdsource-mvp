-- Live Prompt Game module — isolated tables. Do not modify existing events table.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).

-- Sessions: one per "game" (WAITING → RESPONDING → VOTING cycles).
create table if not exists public.prompt_game_sessions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null default 'Live Prompt Game',
  state text not null default 'WAITING' check (state in ('WAITING', 'RESPONDING', 'VOTING')),
  current_round_id uuid,
  linked_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Rounds: one per "Send Prompt Live".
create table if not exists public.prompt_game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prompt_game_sessions(id) on delete cascade,
  prompt_text text not null,
  response_type text not null default 'short_phrase' check (response_type in ('one_word', 'short_phrase', 'sentence')),
  character_limit int not null default 140,
  timer_seconds int,
  created_at timestamptz default now(),
  closed_at timestamptz,
  prompt_block jsonb
);

alter table public.prompt_game_sessions
  add constraint fk_current_round
  foreign key (current_round_id) references public.prompt_game_rounds(id) on delete set null;

-- Raw submissions (audience responses).
create table if not exists public.prompt_game_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prompt_game_sessions(id) on delete cascade,
  round_id uuid not null references public.prompt_game_rounds(id) on delete cascade,
  device_id text not null,
  raw_text text not null,
  created_at timestamptz default now(),
  hidden boolean default false,
  locked boolean default false
);

create index if not exists idx_prompt_game_submissions_session_round
  on public.prompt_game_submissions(session_id, round_id);

-- Votes: one row per vote; max 3 per device per round enforced in app.
create table if not exists public.prompt_game_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prompt_game_sessions(id) on delete cascade,
  round_id uuid not null references public.prompt_game_rounds(id) on delete cascade,
  submission_id uuid not null references public.prompt_game_submissions(id) on delete cascade,
  device_id text not null,
  created_at timestamptz default now(),
  unique(submission_id, device_id)
);

create index if not exists idx_prompt_game_votes_round
  on public.prompt_game_votes(round_id);

-- AI outputs (Song Pack, themes, etc.) — parallel to raw, never overwrites raw.
create table if not exists public.prompt_game_ai_outputs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prompt_game_sessions(id) on delete cascade,
  round_id uuid references public.prompt_game_rounds(id) on delete set null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_prompt_game_ai_outputs_session
  on public.prompt_game_ai_outputs(session_id);
