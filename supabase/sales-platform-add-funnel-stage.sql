-- Post-approval funnel tracking: once an opportunity is approved and the email launched, there was
-- no way to see where it stood afterward (replied? closed? gone cold?) or to track it toward a
-- decision. Adds Joel's actual mental model — Awareness → Interest → Purchase, plus a terminal,
-- non-funnel "Lost" bucket for anything that goes cold — as an explicit column, distinct from
-- opportunities.status (which tracks the AI pipeline's own state: new/researching/approved/etc.,
-- see database.md). null = not yet sent (the pipeline/queue hasn't approved it yet).
--
-- stage_updated_at is a new, separate timestamp from approval_queue_items.decided_at: decided_at
-- is "when the queue decision was made" (approve/reject/defer/etc., set once), stage_updated_at is
-- "when the funnel stage last changed" (set on approval and again every time a human advances or
-- corrects the stage afterward) — see app/api/sales/queue/[itemId]/decision/route.ts and
-- app/api/sales/opportunities/[oppId]/stage/route.ts.
--
-- Purely additive. Run once in the Supabase SQL Editor (sales-platform-tables.sql must already be
-- applied).

alter table if exists public.opportunities
  add column if not exists relationship_stage text
    check (relationship_stage in ('awareness', 'interest', 'purchase', 'lost'));

alter table if exists public.opportunities
  add column if not exists stage_updated_at timestamptz;

create index if not exists opportunities_relationship_stage_idx on public.opportunities (relationship_stage);
