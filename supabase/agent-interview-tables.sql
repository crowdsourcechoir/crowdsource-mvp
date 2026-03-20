-- Agent Interview (Cycle A). Run after events-table.sql.
-- Adds: agent_themes, events columns, participants, conversations, turns, song_seeds.

-- 1. Agent themes (prompt templates + settings)
create table if not exists public.agent_themes (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  tone text not null default 'warm',
  question_goals jsonb not null default '[]',
  max_questions int not null default 8,
  do_dont_rules jsonb not null default '[]',
  system_prompt_template text not null default '',
  created_at timestamptz default now()
);

comment on column public.agent_themes.tone is 'e.g. warm/playful, professional, gratitude/mission';
comment on column public.agent_themes.question_goals is 'e.g. ["memories","shoutouts","values","impact"]';
comment on column public.agent_themes.do_dont_rules is 'e.g. ["first names only","avoid private info","keep answers short"]';

insert into public.agent_themes (key, name, tone, question_goals, max_questions, do_dont_rules, system_prompt_template)
values
  (
    'birthday',
    'Birthday Party',
    'warm/playful',
    '["memories","shoutouts","fun moments","wishes"]'::jsonb,
    8,
    '["first names only","keep answers short","avoid private details"]'::jsonb,
    'You are a warm, friendly host at a birthday celebration. Ask one short, casual question at a time. Draw out memories, shoutouts, and light wishes. Use the event context and agent brief to personalize. Do not collect sensitive personal info. Keep questions conversational and high-signal.'
  ),
  (
    'conference',
    'Conference',
    'professional',
    '["session feedback","networking","key takeaways","values"]'::jsonb,
    8,
    '["first names only","keep answers concise","professional tone"]'::jsonb,
    'You are a professional but approachable facilitator at a conference. Ask one short question at a time about sessions, connections, or takeaways. Use the event context and agent brief. Keep tone professional and conversational. Do not collect sensitive info.'
  ),
  (
    'fundraiser',
    'Fundraiser',
    'gratitude/mission',
    '["impact","gratitude","mission connection","stories"]'::jsonb,
    8,
    '["first names only","keep answers short","mission-focused"]'::jsonb,
    'You are a warm facilitator at a fundraiser. Ask one short question at a time about impact, gratitude, or connection to the mission. Use the event context and agent brief. Keep tone appreciative and mission-focused. Do not collect sensitive info.'
  )
on conflict (key) do nothing;

-- 2. Extend events for agent interview
alter table public.events
  add column if not exists agent_theme_id uuid references public.agent_themes(id) on delete set null,
  add column if not exists agent_brief jsonb default null;

comment on column public.events.agent_brief is 'Structured brief: event_name, event_type, who_what, emotional_arc, ask_about[], avoid[], example_answers[]';

-- 3. Participants (one per interview start per event; optional name)
create table if not exists public.agent_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text default null,
  session_token text not null,
  created_at timestamptz default now(),
  unique(event_id, session_token)
);

create index if not exists idx_agent_participants_event on public.agent_participants(event_id);

-- 4. Conversations (one per participant per event)
create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.agent_participants(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(participant_id)
);

create index if not exists idx_agent_conversations_event on public.agent_conversations(event_id);

-- 5. Turns (agent and user messages)
create table if not exists public.agent_conversation_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  turn_index int not null,
  role text not null check (role in ('agent','user')),
  content text not null default '',
  audio_url text default null,
  video_url text default null,
  created_at timestamptz default now()
);

create index if not exists idx_agent_turns_conversation on public.agent_conversation_turns(conversation_id);

-- 6. Song Seeds (generated from agent transcripts)
create table if not exists public.song_seeds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  top_themes jsonb not null default '[]',
  notable_lines jsonb not null default '[]',
  singable_hooks jsonb not null default '[]',
  shoutouts jsonb not null default '[]',
  emotional_tone_summary text default '',
  source_mapping jsonb not null default '[]',
  created_at timestamptz default now()
);

comment on column public.song_seeds.source_mapping is 'Array of { participant_id?, turn_id?, line_index?, field } for attribution';

create index if not exists idx_song_seeds_event on public.song_seeds(event_id);

-- Suno-ready prompts (safe if already applied — see song-seeds-suno-prompts.sql)
alter table public.song_seeds
  add column if not exists suno_prompts jsonb not null default '[]';

comment on column public.song_seeds.suno_prompts is 'Array of 3 ready-to-paste prompts for Suno song engine, generated from this seed';
