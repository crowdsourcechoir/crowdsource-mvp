-- Replace the educational template's hardcoded "Educators tend to…" paragraph with {{fit_reason}}
-- so draft learning (audience precision, strongest hook, audience-job fit) can land. The ACE /
-- City Summit operator edits showed that generic "educators" fluff is exactly what gets rewritten.
--
-- Run once in the Supabase SQL Editor. Idempotent by template name.

update public.outreach_templates
set body_template = E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\n{{fit_reason}}\n\nI''ve included a bit more about the experience here:\n{{book_url}}\n\n{{cta}}\n\nThanks, {{contact_first_name}}!\n\nBest,\nJoel',
    updated_at = now()
where name = 'Educational — v1 default';

-- Keep the general template aligned (thanks with first name when present).
update public.outreach_templates
set body_template = E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\n{{fit_reason}}\n\nI''ve included a bit more about the experience here:\n{{book_url}}\n\n{{cta}}\n\nThanks, {{contact_first_name}}!\n\nBest,\nJoel',
    updated_at = now()
where name = 'General purpose — v1 default';
