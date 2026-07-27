-- Restores the Crowdsource Choir press-quote signature after the fixed "Best,\nJoel" sign-off.
-- Needed because opening drafts via mailto:/clipboard into Gmail does not populate Gmail's own
-- signature settings. Crowdsource Choir is followed by https://crowdsourcechoir.com so the URL
-- auto-links in plain-text mail clients.
-- Idempotent: only appends when the press-quote line is missing.

update public.outreach_templates
set
  body_template = body_template || E'\n\n--\nJoel DeJong\nCreator, Crowdsource Choir\nhttps://crowdsourcechoir.com\n''One of the Pacific Northwest''s Most Talented Composers''\n—American Songwriter',
  updated_at = now()
where body_template not like '%One of the Pacific Northwest%Most Talented Composers%';
