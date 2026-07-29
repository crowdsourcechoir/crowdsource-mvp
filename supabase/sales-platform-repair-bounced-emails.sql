-- Repair bounced outreach emails for AORN, NACADA, and U.S. Conference of Mayors.
-- Run once in the Supabase SQL Editor (production). Idempotent: safe to re-run.
-- Mirror of lib/sales/contacts/repairBouncedEmails.ts — prefer POST /api/sales/contacts/repair-bounced
-- after deploy when the app has SUPABASE_SERVICE_ROLE_KEY; use this SQL when you need the fix
-- immediately without waiting on a deploy.

begin;

-- ========== AORN ==========
update public.contacts
set
  email_verification_status = 'invalid',
  updated_at = now(),
  import_metadata = coalesce(import_metadata, '{}'::jsonb) || jsonb_build_object(
    'bouncedRepair', jsonb_build_object(
      'markedInvalidAt', now(),
      'reason', 'Outbound bounce — replaced with public verified address'
    )
  )
where organization_id = '1e27b156-a0a1-45b1-b81d-54f3bee1b65b'
  and normalized_email in (
    'jdon-baker@aorn.org',
    'pgraling@aorn.org',
    'cmunro@aorn.org',
    'jspear@aorn.org',
    'cspry@aorn.org',
    'dwagner@aorn.org'
  );

insert into public.contacts (
  organization_id, full_name, role_title, email, normalized_email,
  email_verification_status, source, outreach_persona, import_metadata
)
select
  '1e27b156-a0a1-45b1-b81d-54f3bee1b65b',
  v.full_name, v.role_title, v.email, lower(v.email),
  'verified_deliverable', 'manual', v.persona,
  jsonb_build_object('verifiedRepair', jsonb_build_object(
    'repairedAt', now(),
    'sourceUrl', v.source_url,
    'note', 'Human-confirmed public address after outbound bounce'
  ))
from (values
  ('Cate David', 'Account Executive, AORN Expo Sales (MCI)', 'cate.david@wearemci.com', 'conference_planner',
   'https://wearemci.us/files/AORN_2025_Prospectus.pdf'),
  ('AORN Expo Sales', 'Expo / Exhibitor Sales Desk (MCI)', 'aornexhibsales@wearemci.com', 'conference_planner',
   'https://go.networkmediapartners.com/aorn-prospectus'),
  ('AORN Partnerships', 'Vendor Partnerships', 'partner@aorn.org', 'events_director',
   'https://wearemci.us/files/AORN_2025_Prospectus.pdf')
) as v(full_name, role_title, email, persona, source_url)
where not exists (
  select 1 from public.contacts c
  where c.organization_id = '1e27b156-a0a1-45b1-b81d-54f3bee1b65b'
    and c.normalized_email = lower(v.email)
);

update public.contacts
set
  full_name = v.full_name,
  role_title = v.role_title,
  email_verification_status = 'verified_deliverable',
  updated_at = now()
from (values
  ('cate.david@wearemci.com', 'Cate David', 'Account Executive, AORN Expo Sales (MCI)'),
  ('aornexhibsales@wearemci.com', 'AORN Expo Sales', 'Expo / Exhibitor Sales Desk (MCI)'),
  ('partner@aorn.org', 'AORN Partnerships', 'Vendor Partnerships')
) as v(email, full_name, role_title)
where organization_id = '1e27b156-a0a1-45b1-b81d-54f3bee1b65b'
  and normalized_email = lower(v.email);

update public.outreach_drafts d
set contact_id = c.id, updated_at = now()
from public.opportunities o
join public.contacts c
  on c.organization_id = o.organization_id
 and c.normalized_email = 'cate.david@wearemci.com'
where d.opportunity_id = o.id
  and o.organization_id = '1e27b156-a0a1-45b1-b81d-54f3bee1b65b';

-- ========== NACADA ==========
update public.contacts
set
  email_verification_status = 'invalid',
  updated_at = now(),
  import_metadata = coalesce(import_metadata, '{}'::jsonb) || jsonb_build_object(
    'bouncedRepair', jsonb_build_object(
      'markedInvalidAt', now(),
      'reason', 'Outbound bounce — invented nacada.ksu.edu local-part; real mailbox is @ksu.edu'
    )
  )
where organization_id = '99776134-9ed3-40cd-84f4-9c341fb9cac8'
  and normalized_email = 'elisa.shaffer@nacada.ksu.edu';

-- Prefer updating the existing Elisa Shaffer row when present
update public.contacts
set
  email = 'elshaffer@ksu.edu',
  normalized_email = 'elshaffer@ksu.edu',
  role_title = 'Senior Instructional Designer, Executive Office',
  email_verification_status = 'verified_deliverable',
  updated_at = now(),
  import_metadata = coalesce(import_metadata, '{}'::jsonb) || jsonb_build_object(
    'verifiedRepair', jsonb_build_object(
      'repairedAt', now(),
      'sourceUrl', 'https://nacada.ksu.edu/Programs-Services/eTutorials',
      'note', 'Cloudflare-decoded public address after bounce'
    )
  )
where organization_id = '99776134-9ed3-40cd-84f4-9c341fb9cac8'
  and lower(full_name) = 'elisa shaffer';

insert into public.contacts (
  organization_id, full_name, role_title, email, normalized_email,
  email_verification_status, source, outreach_persona, import_metadata
)
select
  '99776134-9ed3-40cd-84f4-9c341fb9cac8',
  v.full_name, v.role_title, v.email, lower(v.email),
  'verified_deliverable', 'manual', v.persona,
  jsonb_build_object('verifiedRepair', jsonb_build_object(
    'repairedAt', now(),
    'sourceUrl', v.source_url,
    'note', 'Human-confirmed public address after outbound bounce'
  ))
from (values
  ('Elisa Shaffer', 'Senior Instructional Designer, Executive Office', 'elshaffer@ksu.edu', 'program_manager',
   'https://nacada.ksu.edu/Programs-Services/eTutorials'),
  ('NACADA Executive Office', 'Executive Office', 'nacada@ksu.edu', 'executive_director',
   'https://nacada.ksu.edu/About-Us/Frequently-Asked-Questions.aspx')
) as v(full_name, role_title, email, persona, source_url)
where not exists (
  select 1 from public.contacts c
  where c.organization_id = '99776134-9ed3-40cd-84f4-9c341fb9cac8'
    and c.normalized_email = lower(v.email)
);

update public.outreach_drafts d
set contact_id = c.id, updated_at = now()
from public.opportunities o
join public.contacts c
  on c.organization_id = o.organization_id
 and c.normalized_email = 'elshaffer@ksu.edu'
where d.opportunity_id = o.id
  and o.organization_id = '99776134-9ed3-40cd-84f4-9c341fb9cac8';

-- ========== U.S. Conference of Mayors ==========
update public.contacts
set
  email_verification_status = 'invalid',
  updated_at = now(),
  import_metadata = coalesce(import_metadata, '{}'::jsonb) || jsonb_build_object(
    'bouncedRepair', jsonb_build_object(
      'markedInvalidAt', now(),
      'reason', 'Outbound bounce — invented firstlast@ format; USCM uses initial+last'
    )
  )
where organization_id = '09fbc5d4-0608-440a-ac42-f5624786e69c'
  and normalized_email = 'jocelynbogen@usmayors.org';

insert into public.contacts (
  organization_id, full_name, role_title, email, normalized_email,
  email_verification_status, source, outreach_persona, import_metadata
)
select
  '09fbc5d4-0608-440a-ac42-f5624786e69c',
  v.full_name, v.role_title, v.email, lower(v.email),
  'verified_deliverable', 'manual', v.persona,
  jsonb_build_object('verifiedRepair', jsonb_build_object(
    'repairedAt', now(),
    'sourceUrl', v.source_url,
    'note', 'Human-confirmed public address after outbound bounce'
  ))
from (values
  ('Geri Powell', 'Managing Director, Mayors Business Council', 'gpowell@usmayors.org', 'executive_director',
   'https://www.usmayors.org/wp-content/uploads/2025/09/2025-2026-brochure-sep-3.pdf'),
  ('Judy Reid', 'Membership Services Manager, Mayors Business Council', 'jreid@usmayors.org', 'program_manager',
   'https://www.usmayors.org/wp-content/uploads/2025/09/2025-2026-brochure-sep-3.pdf'),
  ('Jocelyn Bogen', 'Program Director', 'jbogen@usmayors.org', 'program_manager',
   'https://www.usmayors.org/wp-content/uploads/2020/02/2019PlayBallReport.MEC_.pdf')
) as v(full_name, role_title, email, persona, source_url)
where not exists (
  select 1 from public.contacts c
  where c.organization_id = '09fbc5d4-0608-440a-ac42-f5624786e69c'
    and c.normalized_email = lower(v.email)
);

-- Also patch existing Geri Powell / Judy Reid rows that had no email
update public.contacts
set
  email = 'gpowell@usmayors.org',
  normalized_email = 'gpowell@usmayors.org',
  role_title = 'Managing Director, Mayors Business Council',
  email_verification_status = 'verified_deliverable',
  updated_at = now()
where organization_id = '09fbc5d4-0608-440a-ac42-f5624786e69c'
  and lower(full_name) = 'geri powell'
  and (email is null or normalized_email is distinct from 'gpowell@usmayors.org');

update public.contacts
set
  email = 'jreid@usmayors.org',
  normalized_email = 'jreid@usmayors.org',
  role_title = 'Membership Services Manager, Mayors Business Council',
  email_verification_status = 'verified_deliverable',
  updated_at = now()
where organization_id = '09fbc5d4-0608-440a-ac42-f5624786e69c'
  and lower(full_name) = 'judy reid'
  and (email is null or normalized_email is distinct from 'jreid@usmayors.org');

update public.outreach_drafts d
set contact_id = c.id, updated_at = now()
from public.opportunities o
join public.contacts c
  on c.organization_id = o.organization_id
 and c.normalized_email = 'gpowell@usmayors.org'
where d.opportunity_id = o.id
  and o.organization_id = '09fbc5d4-0608-440a-ac42-f5624786e69c';

commit;
