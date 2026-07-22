-- Rewrites the fixed (non-AI) parts of the default outreach template to match Joel's actual
-- voice/structure from real emails he's sent, rather than the more generic v1 placeholder copy.
-- See docs/sales-platform/ai-workflow.md §8 and lib/sales/pipeline/stages/draft.ts's
-- VOICE_REFERENCE_EMAILS for the source material this is modeled on. {{opening_reason}} and
-- {{fit_reason}} remain AI-filled; everything else here (greeting, self-intro, attachment
-- mention, sign-off, signature block) is fixed text a human wrote, same as before.
-- Run once in the Supabase SQL Editor.

update public.outreach_templates
set body_template = E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\n{{fit_reason}}\n\nI''ve attached a one-page overview of the Anthem Experience. {{cta}}\n\nThanks, and I hope we have a chance to connect.\n\nBest,\n{{sender_name}}\n\n--\n{{sender_name}}\nCreator, Crowdsource Choir\n''One of the Pacific Northwest''s Most Talented Composers''\n—American Songwriter',
    updated_at = now()
where name = 'General purpose — v1 default';
