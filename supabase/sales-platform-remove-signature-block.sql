-- Removes the trailing "--\n{{sender_name}}\nCreator, Crowdsource Choir\n..." press-quote signature
-- block from the general-purpose template, and shortens "Best,\n{{sender_name}}" to a literal
-- "Best,\nJoel" — Joel's email client already appends its own signature, so the template's own
-- block was duplicating it. Matches the shorter sign-off already used by the "Educational — v1
-- default" template (see sales-platform-add-educational-template.sql).
--
-- NOTE: already applied directly against the live database by the assistant on 2026-07-22 (a plain
-- content UPDATE, not a schema change) — this file exists purely so the change has the same
-- reviewable history as every other template edit in this directory. Safe to run again if needed;
-- it's idempotent (matches by template name, sets the same final value).

update public.outreach_templates
set body_template = E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\n{{fit_reason}}\n\nI''ve attached a one-page overview of the Anthem Experience. {{cta}}\n\nThanks, and I hope we have a chance to connect.\n\nBest,\nJoel',
    updated_at = now()
where name = 'General purpose — v1 default';
