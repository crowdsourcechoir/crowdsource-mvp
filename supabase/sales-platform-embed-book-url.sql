-- Replaces "I've attached a one-page overview..." with a single branded experience URL in both
-- approved outreach templates. The draft stage fills {{book_url}} from SALES_BOOK_URL (default
-- https://www.crowdsourcechoir.com/book — see lib/sales/pipeline/stages/draft.ts). Cold outreach
-- points at the /book page; pricing PDFs and other attachments wait until they reply.
--
-- Run once in the Supabase SQL Editor. Idempotent: matches by template name and sets the same
-- final body_template.
--
-- Already-queued drafts keep the old "I've attached..." wording until those orgs are reprocessed.

update public.outreach_templates
set body_template = E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\n{{fit_reason}}\n\nI''ve included a bit more about the experience here:\n{{book_url}}\n\n{{cta}}\n\nThanks, and I hope we have a chance to connect.\n\nBest,\nJoel',
    updated_at = now()
where name = 'General purpose — v1 default';

update public.outreach_templates
set body_template = E'Hi {{contact_first_name}},\n\nI hope you''re doing well!\n\nI''m {{sender_name}}, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. {{opening_reason}}\n\nWe''ve found that educational conferences are a particularly natural fit for Crowdsource Choir. Educators tend to arrive curious, collaborative, and willing to participate, so they quickly move from being an audience to becoming creators. By the end of the experience, they''ve not only learned together—they''ve created something together that''s unique to that gathering.\n\nI''ve included a bit more about the experience here:\n{{book_url}}\n\n{{cta}}\n\nThanks, and I hope we have a chance to connect.\n\nBest,\nJoel',
    updated_at = now()
where name = 'Educational — v1 default';
