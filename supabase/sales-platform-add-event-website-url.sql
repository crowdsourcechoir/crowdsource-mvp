-- Adds a dedicated conference/event website URL on opportunities so the queue and digest can
-- surface the event's own site in prospect info. When null, the UI falls back to the organization's
-- main website_url (see lib/sales/prospectWebsite.ts).
--
-- Purely additive. Run once in the Supabase SQL Editor (sales-platform-tables.sql must already be
-- applied).

alter table if exists public.opportunities
  add column if not exists event_website_url text;
