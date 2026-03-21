-- Async Whisper transcripts (filled shortly after submit; used by Song Seed without re-transcribing).
alter table public.agent_conversation_turns
  add column if not exists audio_transcript text default null,
  add column if not exists video_transcript text default null;

comment on column public.agent_conversation_turns.audio_transcript is 'Whisper result for audio_url; set by background job after submit';
comment on column public.agent_conversation_turns.video_transcript is 'Whisper result for video_url; set by background job after submit';
