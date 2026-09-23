-- Track which approval-queue leads were already included in a morning digest.
-- Without this, the digest re-emails the same pending 70+ orgs every morning.
-- Run once in the Supabase SQL Editor. Purely additive; code falls back if absent.
--
-- Bootstrap: mark existing pending rows as already-surfaced so the next digest is
-- truly net-new (only leads that enter the queue after this migration).

alter table if exists public.approval_queue_items
  add column if not exists last_digested_at timestamptz;

update public.approval_queue_items
set last_digested_at = coalesce(created_at, now())
where status = 'pending'
  and last_digested_at is null;

create index if not exists approval_queue_items_pending_undigested_idx
  on public.approval_queue_items (status, last_digested_at)
  where status = 'pending';
