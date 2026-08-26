-- Optional. Resume sending works without this (stores a marker on gmail_connections.scopes).
-- If you run anything, run ONLY this one-liner — the unique-index script can time out
-- in the Supabase SQL Editor.
--
-- Skip this if Connect Gmail + Resume sending already works.

alter table if exists public.gmail_connections
  add column if not exists sends_enabled boolean not null default false;
