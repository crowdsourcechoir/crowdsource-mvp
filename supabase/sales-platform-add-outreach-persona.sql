-- Buyer-persona classification for drafting strategy (see lib/sales/outreach/persona.ts and
-- docs/sales-platform/ai-workflow.md). Distinct from the existing free-text `role_category`
-- column (a department bucket imported verbatim from the fan-culture CSV) — this is a small
-- controlled taxonomy used to pick the email's ask/CTA, not just its personalization.
-- Purely additive. Run once in the Supabase SQL Editor (sales-platform-tables.sql must already
-- be applied).

alter table if exists public.contacts
  add column if not exists outreach_persona text
    check (outreach_persona in ('executive_director', 'events_director', 'program_manager', 'board_member', 'conference_planner', 'other'));

-- Backfill existing rows with a deterministic classification so today's data isn't stuck showing
-- as unclassified until the next pipeline run touches it. Keeps the same keyword rules as
-- lib/sales/outreach/persona.ts#classifyOutreachPersona — if you change those rules, re-run this
-- (or the equivalent one-off script) to keep stored values in sync; the app also classifies
-- on-the-fly for any row that's still null, so this is a cache, not a hard dependency.
update public.contacts
set outreach_persona = case
  when role_title ~* '\yceo\y|\yexecutive director\y|\ypresident\y|\ychief executive\y|\ysuperintendent\y|\yfounder\y' then 'executive_director'
  when role_title ~* '\yconference (planner|coordinator|manager)\y|\ymeeting planner\y|\yevents? planner\y' then 'conference_planner'
  when role_title ~* '\ydirector of events?\y|\yevents? director\y|\yhead of events?\y|\yvp of events?\y' then 'events_director'
  when role_title ~* '\yprogram (manager|director|coordinator)\y|\yprogramming (manager|director)\y|\ysession (chair|coordinator)\y' then 'program_manager'
  when role_title ~* '\yboard member\y|\ytrustee\y|\yboard of directors\y|\yboard chair\y' then 'board_member'
  else 'other'
end
where outreach_persona is null;

-- Swap the hardcoded closing question for a {{cta}} placeholder so the draft stage can fill in a
-- persona-appropriate ask instead of one generic line for every contact. Deterministic (not
-- AI-authored) so the "ask" always matches the assigned strategy exactly — see
-- lib/sales/pipeline/stages/draft.ts.
update public.outreach_templates
set body_template = replace(
  body_template,
  'Would it be worth a quick conversation, or is there someone else on your team better placed to talk about this?',
  '{{cta}}'
)
where name = 'General purpose — v1 default'
  and body_template like '%Would it be worth a quick conversation, or is there someone else on your team better placed to talk about this?%';
