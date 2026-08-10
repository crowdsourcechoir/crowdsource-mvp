-- Track which approval-queue leads were already included in a morning digest email.
-- Without this, a force-send of the whole pending backlog resets the "new since last digest"
-- cutoff and the cron stays silent for days even though unreviewed 70+ leads remain.
-- Run once in the Supabase SQL Editor. Purely additive; code falls back if the column is absent.

alter table if exists public.approval_queue_items
  add column if not exists last_digested_at timestamptz;

create index if not exists approval_queue_items_pending_undigested_idx
  on public.approval_queue_items (status, last_digested_at)
  where status = 'pending';
