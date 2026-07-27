-- Signature: keep exact words after "Best,\nJoel". Crowdsource Choir is hyperlinked in HTML
-- clipboard / UI (not via a bare URL line). This migration strips any bare
-- https://crowdsourcechoir.com line under "Creator, Crowdsource Choir", then appends the
-- signature when the press-quote block is still missing.

update public.outreach_templates
set
  body_template = regexp_replace(
    body_template,
    E'(Creator, Crowdsource Choir)\\nhttps?://(www\\.)?crowdsourcechoir\\.com/?',
    E'Creator, Crowdsource Choir',
    'g'
  ),
  updated_at = now()
where body_template ~ E'Creator, Crowdsource Choir\\nhttps?://';

update public.outreach_templates
set
  body_template = body_template || E'\n\n--\nJoel DeJong\nCreator, Crowdsource Choir\n''One of the Pacific Northwest''s Most Talented Composers''\n—American Songwriter',
  updated_at = now()
where body_template not like '%One of the Pacific Northwest%Most Talented Composers%';
