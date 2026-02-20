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
  created_at timestamptz default now()
);
