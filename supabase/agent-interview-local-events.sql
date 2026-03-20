-- Agent Interview: support local events (USE_LOCAL_EVENTS=true).
-- Run in Supabase SQL editor. Allows event_id to be null and adds local_event_id for in-memory/local event ids.
-- No tables or data are dropped; only columns and indexes are added.

-- Participants: when event is local, event_id is null and local_event_id = 'local-xxx'
alter table public.agent_participants
  add column if not exists local_event_id text default null,
  alter column event_id drop not null;

create index if not exists idx_agent_participants_event_non_null on public.agent_participants(event_id) where event_id is not null;
create index if not exists idx_agent_participants_local_event on public.agent_participants(local_event_id) where local_event_id is not null;

comment on column public.agent_participants.local_event_id is 'When set, event is from local store (USE_LOCAL_EVENTS); event_id is null';

-- Conversations: same pattern
alter table public.agent_conversations
  add column if not exists local_event_id text default null,
  alter column event_id drop not null;

create index if not exists idx_agent_conversations_event_non_null on public.agent_conversations(event_id) where event_id is not null;
create index if not exists idx_agent_conversations_local_event on public.agent_conversations(local_event_id) where local_event_id is not null;

comment on column public.agent_conversations.local_event_id is 'When set, event is from local store; event_id is null';
