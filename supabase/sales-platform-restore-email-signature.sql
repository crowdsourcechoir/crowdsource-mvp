-- Removes the embedded Crowdsource Choir press-quote signature after "Best,\nJoel".
-- Gmail already appends Joel's signature when drafts launch via mailto:, so embedding it
-- duplicated the block. Idempotent.

update public.outreach_templates
set
  body_template = regexp_replace(
    body_template,
    E'\\n*\\n--\\nJoel DeJong\\nCreator, Crowdsource Choir\\nhttps?://(www\\.)?crowdsourcechoir\\.com/?\\n''One of the Pacific Northwest''s Most Talented Composers''\\n—American Songwriter\\s*$',
    '',
    'g'
  ),
  updated_at = now()
where body_template like '%One of the Pacific Northwest%Most Talented Composers%';

update public.outreach_templates
set
  body_template = regexp_replace(
    body_template,
    E'\\n*\\n--\\nJoel DeJong\\nCreator, Crowdsource Choir\\n''One of the Pacific Northwest''s Most Talented Composers''\\n—American Songwriter\\s*$',
    '',
    'g'
  ),
  updated_at = now()
where body_template like '%One of the Pacific Northwest%Most Talented Composers%';
