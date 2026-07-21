# Initial Data Import

v1 is seeded from two existing files rather than an empty system with one hand-typed organization:

- `Conferences CRM data.csv` — 250 rows / 248 unique organizations, organization + opportunity level, no named contacts
- `Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv` — 145 named contacts across 32 organizations, sports/university vertical

Both are pre-existing prospect research (association/conference targets in one file, real named sports-org contacts in the other) — not pipeline output. They are treated as **unverified human-provided input**, exactly like any other lead source: they still go through normalization, still get scored, and their claims are marked as needing verification rather than treated as confirmed facts. This is the same "evidence before inference" rule applied to import instead of live web research.

## What this confirms/changes about the schema

- **Confirms the org→many-opportunities model is necessary, not theoretical.** Microsoft (Build, Ignite) and Gartner (IT Symposium/Xpo, ReimagineHR) each appear twice in the conferences file as the same organization with two distinct annual events — import must dedupe on organization, not create two Microsofts.
- **Confirms `contacts.email` must tolerate being empty.** 66 of 145 contacts in the fan-culture file have no email yet — they still need to be imported (real name + title + org + role is useful for targeting) and picked up by contact verification/discovery later, not discarded for missing an email.
- **Adds four small columns** (documented in `database.md`) to avoid losing information these files already contain rather than cramming it into free text:
  - `opportunities.target_contact_role_hint` (text, nullable) — from the conferences file's "Likely Buyer / Owner" column: a *role description*, not a named person. Feeds stage 4 (contact discovery) as a search target when no contact exists yet.
  - `contacts.phone` (text, nullable) and `contacts.role_category` (text, nullable) — from the fan-culture file's `Phone` and `Contact Type` columns.
  - `research_findings.origin` (text, not null, default `'ai_research'`, also allows `'human_provided'`) — the conferences file's "Why It Fits" rationale becomes a `human_provided` finding citing the row's source URL, distinct from anything the pipeline verifies itself later. This keeps the audit trail honest: a human's hypothesis and the pipeline's own verification are never conflated into one unlabeled fact.
  - `organizations.import_metadata` / `opportunities.import_metadata` / `contacts.import_metadata` (jsonb, nullable) — the original CSV row, verbatim, plus source filename and import timestamp. Nothing from the source files is discarded even if a column isn't modeled explicitly (e.g. the conferences file's "Data Confidence" caveat text, or the fan-culture file's "Warm Intro"/"Next Action" columns, which are populated inconsistently or generically today).

## Column mapping

### `Conferences CRM data.csv` → `organizations` + `opportunities` + `research_findings`

| CSV column | Maps to | Notes |
|---|---|---|
| `Organization` | `organizations.name` (+ `normalized_name`, `domain` derived) | Dedupe key within this import |
| `Category` (e.g. `Education`, `Tech / SaaS / Customer Conference`) | `industry_segments` (matched/created) | Not a direct `organization_types` value — the actual type (`association`, `corporation`, `event_agency`, ...) is inferred by pipeline stage 1, informed by this segment + org name, not hardcoded from the CSV |
| `Annual Gathering / Event` | `opportunities.title` + `event_or_initiative_name` | `opportunity_type_id` defaults to `annual_conference` on import; pipeline stage 3 can refine it |
| `Attendance Fit (300-5000)` (`Strong` / `Review Size`) | `research_findings` (`claim_type: audience_size`, `origin: human_provided`) | Explicitly *not* written straight into the `audience_size` score component — it's a claim for stage 6 to weigh alongside anything else found |
| `Likely Buyer / Owner` | `opportunities.target_contact_role_hint` | Not a contact row — no named person exists yet |
| `Why It Fits Crowdsource Choir Anthem Experience` | `research_findings` (`claim_type: program_fit_signal`, `origin: human_provided`) | Cites the row's source URL per finding, same as any other finding |
| `Source / Start URL` | `research_sources.url` | One source row per organization, `retrieval_status` marked distinctly (e.g. `imported`) since it wasn't fetched by the pipeline |
| `Data Confidence` (free text, e.g. "attendance should be verified before outreach") | `organizations.import_metadata` + folded into the opportunity's eventual `prospect_scores.missing_information` | Preserved verbatim; also nudges `missing_information` so the queue visibly shows "attendance unverified" rather than silently dropping the caveat |
| `Priority` (`A`/`B`) | `organizations.import_metadata` only | Informational context from the source list, not a substitute for the pipeline's own `prospect_scores.total_score` |

### `Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv` → `organizations` + `contacts`

| CSV column | Maps to | Notes |
|---|---|---|
| `Organization` | `organizations.name` | Dedupe key; type strongly implied (`University` category → `university`; sport categories → `sports_team`), still confirmed by stage 1 rather than trusted blindly |
| `Category` (`University`, `Baseball`, `Soccer`, `Hockey`, `Basketball`) | `industry_segments` + a signal for `organization_type_id` | |
| `Primary Sport/Focus`, `City`, `State` | `organizations.import_metadata` (+ `location_city`/`location_region`) | |
| `Contact Name` | `contacts.full_name` | |
| `Title` | `contacts.role_title` | |
| `Email` | `contacts.email` + `normalized_email` | When blank, contact is still created with `email_verification_status = 'unverified'`; discovery/verification stages can attempt to find one later |
| `Phone` | `contacts.phone` | |
| `Website` | `organizations.website_url` | |
| `Source URL` | `research_sources.url`, referenced by a `research_findings` row of `claim_type: decision_maker`, `origin: human_provided` | The staff-directory page this contact was found on |
| `Priority` | `organizations.import_metadata` only | Same reasoning as the conferences file |
| `Contact Type` | `contacts.role_category` | |
| `Status`, `Warm Intro`, `Last Contact`, `Next Action`, `Notes` | `contacts.import_metadata` | All rows currently read `Not Contacted` / mostly blank — informational only, not modeled as columns since there's no per-row variation to act on yet |

## Import mechanism for v1

A one-off script, not a UI upload feature — matches the existing `scripts/` convention (`scripts/prod-preflight.mjs`) and avoids building CSV-upload UI before there's a repeated need for it:

- `scripts/sales/import-conferences-csv.mjs`
- `scripts/sales/import-fan-culture-csv.mjs`

Both are idempotent (safe to re-run: match existing organizations by `domain`/`normalized_name` before inserting, match existing contacts by `normalized_email` or, when there's no email, by `organization_id` + normalized full name) and log a per-row summary (created / matched-existing / skipped + reason) rather than failing the whole batch on one bad row.

The general CSV-upload UI (`/admin/sales/organizations` → "Import") described in `architecture.md` remains a Phase 2 feature, for whenever the next new list arrives from someone other than a developer running a script.

## Sequencing

Import happens **before** the pipeline runs, not instead of it:

1. Run both import scripts once → creates `organizations`, `opportunities` (conferences file only), `contacts` (fan-culture file only), seed `research_sources`/`research_findings` marked `origin: human_provided`.
2. From `/admin/sales/organizations`, trigger the pipeline per organization as normal. Stage 2 (research) still runs and can add/corroborate findings; stage 3 (opportunity detection) still runs for the fan-culture organizations, which arrived with contacts but no defined opportunity yet (likely `fan_engagement_initiative` or `team_season_launch` — inferred, not assumed); stage 4 (contact discovery) is effectively pre-seeded for fan-culture orgs and still runs for conference orgs (which only have a role hint, no person).
3. Everything still lands in the approval queue for a human decision — import does not skip approval for any row.
