-- Allow digest cron to record "still under the score/count target, keep topping up" without
-- advancing the "new since last digest" cutoff (only `succeeded` does that). Safe to re-run.
-- sales-platform-add-digest.sql must already be applied.

alter table public.digest_runs drop constraint if exists digest_runs_status_check;

alter table public.digest_runs
  add constraint digest_runs_status_check
  check (status in ('running', 'succeeded', 'failed', 'skipped_no_provider', 'deferred'));
