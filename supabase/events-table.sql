-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create the events table.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text default '',
  date text not null,
  time text not null,
  venue text default '',
  address text default '',
  prompt text default '',
  hero_image text default '',
  hero_image_mode text not null default 'bw' check (hero_image_mode in ('bw', 'color')),
  landing_headline text not null default 'We''re crowdsourcing a song for this event. Want to help create it?',
  landing_copy text not null default '',
  cta_text text not null default 'Let''s make an anthem',
  anthem_completion_message text not null default 'Thanks! Your answers will help shape the song we''re making.',
  allow_audio_video_prompt boolean not null default true,
  created_at timestamptz default now()
);

alter table public.events
  add column if not exists hero_image_mode text not null default 'bw';
alter table public.events
  add column if not exists landing_headline text not null default 'We''re crowdsourcing a song for this event. Want to help create it?';
alter table public.events
  add column if not exists landing_copy text not null default '';
alter table public.events
  add column if not exists cta_text text not null default 'Let''s make an anthem';
alter table public.events
  add column if not exists anthem_completion_message text not null default 'Thanks! Your answers will help shape the song we''re making.';
alter table public.events
  add column if not exists allow_audio_video_prompt boolean not null default true;

-- Service-role-only access (Next.js API routes). Deny anon/authenticated PostgREST.
alter table if exists public.events enable row level security;
