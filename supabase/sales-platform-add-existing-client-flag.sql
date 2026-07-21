-- Adds an "existing client" flag to organizations, so the pipeline never prospects an
-- organization that's already a customer. Run this once in the Supabase SQL Editor
-- (sales-platform-tables.sql must already be applied).
alter table if exists public.organizations
  add column if not exists is_existing_client boolean not null default false;

create index if not exists organizations_is_existing_client_idx on public.organizations (is_existing_client);
