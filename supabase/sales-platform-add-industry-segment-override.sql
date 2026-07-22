-- Lets an organization's industry segment be set explicitly, overriding the segment it would
-- otherwise inherit transitively through organization_type_id (see database.md's
-- organization_types.industry_segment_id). That inheritance is too coarse for `association`:
-- every association-type org resolves to `associations_leadership` today regardless of what field
-- it's actually in, even though `industry_segments` already has an `education` row — there was no
-- way to tell ISACS (an independent-school association) apart from a healthcare or business
-- association. Resolution order (see lib/sales/db/lookups.ts#resolveIndustrySegmentIdForOrganization
-- and lib/sales/pipeline/stages/draft.ts): organizations.industry_segment_id if set, else
-- organization_types.industry_segment_id.
--
-- Also adds outreach_templates.industry_segment_id so a template can be targeted at a resolved
-- industry segment (e.g. the new 'Educational — v1 default' template, added in
-- sales-platform-add-educational-template.sql) — see lib/sales/db/outreach.ts#findApprovedTemplate.
--
-- Run this AFTER sales-platform-tables.sql. Purely additive. Run once in the Supabase SQL Editor.

alter table if exists public.organizations
  add column if not exists industry_segment_id uuid references public.industry_segments(id) on delete set null;

alter table if exists public.outreach_templates
  add column if not exists industry_segment_id uuid references public.industry_segments(id) on delete set null;

-- ── Backfill: education-sector organizations currently miscategorized under organization_type
-- 'association' (which resolves to 'associations_leadership', not 'education') or 'nonprofit'.
--
-- Deliberately an explicit, hand-reviewed id list, NOT a keyword regex — naive keyword matching
-- misfires badly here (e.g. "American College of Healthcare Executives" contains "College" but is
-- a healthcare association; "Council of Independent Colleges" genuinely is higher-ed). Every id
-- below was checked by reading the real organizations table (scripts/sales/_status-audit.mjs) one
-- name at a time, not pattern-matched. Organizations already typed 'university'/'school' already
-- resolve to 'education' via organization_types and need no override (e.g. every
-- "<X> University Athletics" row).
--
-- Deliberately excluded despite surface similarity: "Association for Experiential Education"
-- (spans outdoor/therapeutic/corporate team-building, not specifically the K-12/higher-ed vertical
-- this override targets), "Product School" (a for-profit tech-industry bootcamp, not an
-- education-sector institution/association), "AcademyHealth" (health-services policy research
-- despite the name).
update public.organizations
set industry_segment_id = (select id from public.industry_segments where key = 'education'),
    updated_at = now()
where id in (
  -- Independent-school associations (regional/state) — same category as ISACS
  '3dba0e97-669c-4a75-b46d-181a5e2f2738', -- Independent Schools Association of the Central States (ISACS)
  '6a080f2b-973c-4671-a2ba-34a619725b49', -- National Association of Independent Schools (NAIS)
  '34d92370-3888-4451-905d-c6b604f9176e', -- California Association of Independent Schools (CAIS)
  '3cc50ac5-8274-4cb2-8a18-9ad07165dc17', -- Northwest Association of Independent Schools (NWAIS)
  'c49bd35d-c5bc-4a19-994d-b6975abc6bef', -- Association of Independent Schools in New England
  '7428983e-f013-490d-8bf0-0422e6082ec7', -- New York State Association of Independent Schools
  'fcad6588-2d65-40b7-94eb-68b26d7228b0', -- Pennsylvania Association of Independent Schools
  '43480fb6-7479-4ecf-a0ce-3a307434bfe0', -- Southern Association of Independent Schools
  '5cee4648-8cd4-4495-900a-d8d0d353e5fc', -- Virginia Association of Independent Schools
  'a198df3e-e155-4ca9-949f-dfd5a7853c2f', -- Texas Private Schools Association

  -- K-12 administrators / school boards
  '636a7012-3083-41b9-9315-b67b8343a76d', -- AASA, The School Superintendents Association
  '6621d15c-5a25-40b1-97c3-d4d357643cf4', -- National School Boards Association
  '6cd67d71-00e2-45ab-b7eb-db07ab01162f', -- National Association of Elementary School Principals
  '49b71015-62c5-4211-ad72-0ffb49ad8fc5', -- National Association of Secondary School Principals
  '1d7654ce-8e9c-494d-b11a-02b57804c2e0', -- Association for Middle Level Education
  '1968509b-ae87-47fb-909c-95a80911f9aa', -- ASCD (Association for Supervision and Curriculum Development)

  -- Higher-ed institutions / administration
  '2a687896-8368-405c-adbd-3042d93d134e', -- Council of Independent Colleges
  '5893952d-820c-4a0c-ab4f-51fdf9403416', -- Council for Advancement and Support of Education
  'e0e1323e-a4db-40cd-a342-6a7bd2c7d31e', -- American Council on Education
  '8a59c3ca-c96c-4184-a61a-c97e728f4a34', -- Association of Governing Boards of Universities and Colleges
  '4b58c19c-c833-4a40-b546-d2af7516f58f', -- National Association of College and University Business Officers
  'e4e6dd15-e09c-4a0d-9308-86c96b1acc91', -- NASPA (student affairs administrators)
  'bb908d7d-cfab-4398-8798-cc9c9f2eeff1', -- ACPA (college student educators)
  'e75bbd64-61fa-4537-b9ec-d27fc36f5661', -- NACAC (college admission counseling)
  '99776134-9ed3-40cd-84f4-9c341fb9cac8', -- NACADA (academic advising)
  'e1bd5da2-8e92-4cf4-a28a-e0411de56d3d', -- National Association for Campus Activities
  'd3eb2c6a-bbaa-4291-9e7f-b4e4e041da47', -- UPCEA (professional/continuing/online education)
  '482e30de-2b3b-4795-ac64-ad14908df7ab', -- Educause (higher-ed IT)

  -- Subject-specific K-12/higher-ed teaching associations
  '82004fc6-13ae-48fc-a3a1-360bf6a6fd4c', -- ISTE (education technology)
  '974275fa-8685-49a4-a622-c0da4a282d1d', -- National Association for Music Education
  '16db7079-955b-428c-bbcf-2beb0fc99ddd', -- National Art Education Association
  '3f0f2902-d008-4191-984d-2c6346c388ae', -- National Council of Teachers of English
  'c1c09828-661b-46e0-9036-b2cbbf009485', -- National Science Teaching Association
  'fcda1623-df59-465b-8b6d-ac6d1c8a37b6', -- National Guild for Community Arts Education

  -- Education-focused nonprofit (mistyped 'nonprofit', not 'association', but still education)
  '0fbefe84-b2fc-4002-95c0-e55200e174e4'  -- Learning Forward (educator professional development)
);
