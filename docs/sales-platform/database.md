# Database

No migrations are created yet. This document is the proposed schema — for review before we write `supabase/sales-platform-tables.sql`.

The two initial seed files (`Conferences CRM data.csv`, `Crowdsource_Fan_Culture_CRM_real_contacts_v1.csv`) surfaced a handful of small additive columns (`import_metadata`, `target_contact_role_hint`, `contacts.phone`/`role_category`, `research_findings.origin`) so nothing from those files is lost or misattributed on import — see [`data-import.md`](./data-import.md) for the full column-by-column mapping. Those columns are already included in the tables below.

Conventions match the existing codebase: `uuid primary key default gen_random_uuid()`, `timestamptz default now()`, snake_case columns, one additive `.sql` file, RLS enabled with no policies (service-role-only access), foreign keys with `on delete` behavior chosen deliberately per relationship (mostly `restrict`/`set null`, never a silent cascading delete of research/audit history).

## Refinements to the originally proposed entity list

| Original proposal | Decision | Why |
|---|---|---|
| `organizations`, `contacts`, `opportunities` | Kept as-is | Core objects, map directly to the workflow |
| `research_runs` | Renamed to **`pipeline_runs`** | "Research run" implied only the research stage; this row actually represents the *whole* end-to-end pipeline pass for an organization (all 12 stages), so it's the parent of `agent_runs`, not a sibling of it |
| `research_sources` | Kept, refined | Now stores *fetched source documents* (url, fetched_at, content hash) rather than being overloaded to also carry individual claims |
| *(new)* `research_findings` | **Added** | The spec requires "every important research claim" to carry a source. A source document can support several distinct claims (attendance size, event date, decision-maker name...) — without a findings table, claim-level attribution collapses into unstructured text on the source row, and scoring/drafting can't cite a specific claim |
| `prospect_scores` | Kept as-is | Matches the explainable-scoring requirement directly |
| *(new)* `outreach_templates` | **Added** | The draft generator is required to use "approved email templates." Templates need their own lifecycle (draft/approved/retired) independent of any single generated email |
| `outreach_drafts` | Kept, refined | Stores both the AI-generated version and the human-edited version as distinct fields (never overwritten in place) |
| `approval_queue_items` | Kept as-is | The queue is a view over "opportunities ready for a decision," but it needs its own row for decision state/history |
| `outreach_activities` | Kept as-is | Timeline/follow-up tracking, decoupled from HubSpot so it works even if HubSpot sync fails |
| `hubspot_sync_records` | Kept as-is | Generic join table so any entity type can be synced without new tables per object type |
| `industry_segments` | Kept, demoted to optional grouping | A broader grouping *above* `organization_types` (e.g. "Sports & Entertainment" groups `sports_team` + `sports_league`) for reporting/weighting, not required for the pipeline to function |
| `user_preferences` | Kept, scoped to one row for v1 | See note in that table's section — shaped to extend to real multi-user later without a rewrite |
| `agent_runs` | Kept as-is | Per-stage execution ledger, child of `pipeline_runs` |
| *(new)* `organization_types`, `opportunity_types` | **Added as lookup tables** | The spec explicitly requires extensibility without schema/app changes when adding a type — an enum or hardcoded switch statement would violate that; a lookup table means adding a type is an `insert` |

## Entity-relationship overview

```
organization_types ──┐
industry_segments ───┤
                      ▼
                organizations ──┬──< contacts
                      │         │
                      │         └──< opportunities ──> opportunity_types
                      │                   │
                      ▼                   ▼
                pipeline_runs ──< agent_runs (12 stage rows per run)
                      │
                      ├──< research_sources ──< research_findings ──> (organizations | opportunities)
                      ├──< prospect_scores ──> opportunities
                      ├──< outreach_drafts ──> opportunities, contacts, outreach_templates
                      ├──< approval_queue_items ──> opportunities
                      ├──< outreach_activities ──> opportunities, contacts
                      └──< hubspot_sync_records ──> (organizations | contacts | opportunities)
```

## Table-by-table

### `organization_types`
Lookup table, not an enum — new types are inserted, never require a deploy.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `key` | text unique | e.g. `conference`, `sports_team`, `university`; matches the seed list in the brief plus `other` |
| `label` | text | Display name |
| `industry_segment_id` | uuid, fk → `industry_segments`, nullable | Optional grouping |
| `is_active` | boolean default true | Allows retiring a type without deleting history |
| `created_at` | timestamptz | |

Seed rows at migration time: `conference`, `association`, `corporation`, `sports_team`, `sports_league`, `university`, `school`, `nonprofit`, `festival`, `venue`, `event_agency`, `destination_marketing_organization`, `other`.

### `industry_segments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `key` | text unique | e.g. `education`, `sports_entertainment`, `corporate`, `nonprofit_community` |
| `label` | text | |

### `organizations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | text not null | |
| `normalized_name` | text not null | Lowercased/punctuation-stripped, used for dedupe matching |
| `domain` | text, nullable | Primary website domain, lowercased, no protocol — main dedupe key |
| `organization_type_id` | uuid, fk → `organization_types`, not null | |
| `website_url` | text, nullable | |
| `location_city` | text, nullable | |
| `location_region` | text, nullable | State/province |
| `location_country` | text, nullable | |
| `estimated_size` | text, nullable | Free-form until we have enough data to model numerically |
| `source` | text not null | `manual`, `csv_import`, `ai_discovered` |
| `duplicate_of_organization_id` | uuid, fk → `organizations`, nullable | Set when a human confirms a duplicate; original row is kept, never deleted, for audit continuity |
| `import_metadata` | jsonb, nullable | Verbatim original row + source filename/timestamp, for rows created via CSV import — see `data-import.md` |
| `created_at` / `updated_at` | timestamptz | |

Indexes: unique-ish index on `domain` where not null; index on `normalized_name` (trigram or btree) for fuzzy dedupe lookups.

### `contacts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid, fk → `organizations`, not null | v1 keeps this a simple one-to-many (an agency contact repping multiple orgs is a Phase 2+ many-to-many; see Open Questions in `roadmap.md`) |
| `full_name` | text, nullable | May be unknown until verification |
| `role_title` | text, nullable | |
| `email` | text, nullable | |
| `normalized_email` | text, nullable | Lowercased/trimmed — dedupe key |
| `email_verification_status` | text not null default `'unverified'` | `unverified`, `valid_format`, `verified_deliverable`, `invalid`, `risky` |
| `phone` | text, nullable | |
| `role_category` | text, nullable | Department/role bucket (e.g. "Marketing/Fan Engagement"), distinct from the free-text `role_title` — useful for contact-quality/decision-maker-access scoring |
| `linkedin_url` | text, nullable | |
| `source` | text not null | `ai_discovered`, `manual`, `hubspot_import`, `csv_import` |
| `enrichment_attempted_at` | timestamptz, nullable | Phase 2. Set exactly once per contact the first time the enrichment stage runs on it — this, not a status check, is what stops the pipeline from re-billing a paid API call for the same contact on every re-run |
| `enrichment_provider` | text, nullable | `apollo`, `hunter` — whichever provider was active (by env var) when the attempt was made |
| `enrichment_status` | text, nullable | `found`, `not_found`, `error` |
| `duplicate_of_contact_id` | uuid, fk → `contacts`, nullable | Same pattern as organization dedupe |
| `import_metadata` | jsonb, nullable | Same purpose as `organizations.import_metadata` |
| `created_at` / `updated_at` | timestamptz | |

### `opportunity_types`
Same lookup pattern as `organization_types`. Seed rows: `annual_conference`, `employee_gathering`, `fan_engagement_initiative`, `team_season_launch`, `university_orientation`, `fundraising_gala`, `leadership_retreat`, `community_festival`, `association_convention`, `other`.

### `opportunities`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid, fk → `organizations`, not null | |
| `opportunity_type_id` | uuid, fk → `opportunity_types`, not null | |
| `title` | text not null | e.g. "2027 Annual Members Conference" |
| `event_or_initiative_name` | text, nullable | |
| `event_date_estimate` | date, nullable | |
| `event_date_confidence` | text, nullable | `confirmed`, `estimated`, `unknown` |
| `description` | text, nullable | Short human/AI summary |
| `status` | text not null default `'new'` | `new`, `researching`, `awaiting_contact`, `ready_for_review`, `approved`, `rejected`, `deferred`, `needs_more_research`, `duplicate`. `awaiting_contact` (added post-v1) means the opportunity survived scoring/brief but has no contact clearing the verified-email bar yet (`valid_format`/`verified_deliverable`) — it's deliberately kept out of `ready_for_review` so the queue never becomes a place to do contact research; see `ai-workflow.md` §4/§10. It's an "undecided" status like `new`/`researching`/`ready_for_review`, so a later pipeline re-run (e.g. once enrichment finds a verified email) re-processes it and can advance it to `ready_for_review` |
| `target_contact_role_hint` | text, nullable | A role description (e.g. "Conference director / executive director") to guide contact discovery when no named contact exists yet — not a substitute for a real `contacts` row |
| `import_metadata` | jsonb, nullable | Same purpose as `organizations.import_metadata` |
| `created_at` / `updated_at` | timestamptz | |

### `discovery_runs`
Stage 0 (see `ai-workflow.md`). One row per nightly/manual organization-discovery run. A sibling of `pipeline_runs`, not a child — there's no organization row yet when discovery runs, so this isn't an `agent_runs` stage either. Added in `supabase/sales-platform-add-discovery.sql`, a later additive migration (not in the original schema below).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `trigger` | text not null | `manual`, `cron` |
| `status` | text not null default `'running'` | `running`, `succeeded`, `failed` |
| `provider` | text, nullable | `tavily`, `serper`, or null if neither API key was configured (no-op run) |
| `queries` | jsonb not null default `'[]'` | `[{ query, resultsCount, candidatesExtracted }, ...]` — the exact queries run this pass and what each returned |
| `candidates_found` / `candidates_new` / `candidates_duplicate` | int not null default 0 | Extracted-but-not-yet-deduped count, genuinely-new-org count, and already-existing-org count |
| `created_organization_ids` | uuid[] not null default `'{}'` | The `organizations` rows actually created by this run, each with `source = 'ai_discovered'` |
| `model` / `tokens_input` / `tokens_output` / `cost_usd` | | Same provenance/cost tracking convention as `agent_runs` |
| `error` | text, nullable | |
| `started_at` / `finished_at` / `created_at` | timestamptz | |

### `pipeline_runs`
One row per end-to-end pipeline pass over an organization (may cover multiple opportunities discovered within it).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid, fk → `organizations`, not null | |
| `trigger` | text not null | `manual`, `cron`, `reprocess_request`, `csv_import` (the two seed CSVs each create one `csv_import` pipeline run per organization to attach their seeded findings/sources to, before any real pipeline stages run) |
| `status` | text not null default `'pending'` | `pending`, `running`, `succeeded`, `failed`, `partially_failed` |
| `current_stage` | text, nullable | Mirrors the stage enum in `ai-workflow.md` |
| `started_at` / `finished_at` | timestamptz, nullable | |
| `total_cost_usd` | numeric, nullable | Sum of child `agent_runs` |
| `created_at` | timestamptz | |

### `agent_runs`
One row per stage attempt within a `pipeline_run`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `pipeline_run_id` | uuid, fk → `pipeline_runs`, not null | |
| `stage` | text not null | `normalize`, `research`, `detect_opportunity`, `find_contact`, `enrich_contact`, `verify_contact`, `score`, `brief`, `draft`, `qa`, `queue`, `hubspot_sync` |
| `status` | text not null default `'pending'` | `pending`, `running`, `succeeded`, `failed`, `retrying`, `skipped` |
| `attempt` | int not null default 1 | |
| `max_attempts` | int not null default 3 | |
| `input` | jsonb, nullable | Exact structured input given to the stage |
| `output` | jsonb, nullable | Exact structured output produced |
| `error` | text, nullable | |
| `model` | text, nullable | e.g. `gpt-4.1-mini` |
| `tokens_input` / `tokens_output` | int, nullable | |
| `cost_usd` | numeric, nullable | |
| `started_at` / `finished_at` | timestamptz, nullable | |
| `created_at` | timestamptz | |

### `research_sources`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `pipeline_run_id` | uuid, fk → `pipeline_runs`, not null | |
| `url` | text not null | |
| `title` | text, nullable | |
| `fetched_at` | timestamptz not null | |
| `content_hash` | text, nullable | For change detection / re-fetch dedupe |
| `raw_excerpt` | text, nullable | The specific excerpt the model was shown, capped in length — full page is never stored |
| `retrieval_status` | text not null default `'ok'` | `ok`, `blocked`, `error`, `paywalled`, `imported` (URL came from an imported file, not a live pipeline fetch) |

### `research_findings`
The atomic sourced claim — what scoring rationale and outreach drafts actually cite.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `pipeline_run_id` | uuid, fk → `pipeline_runs`, not null | |
| `organization_id` | uuid, fk → `organizations`, not null | |
| `opportunity_id` | uuid, fk → `opportunities`, nullable | Null for org-level findings (e.g. company size) |
| `source_id` | uuid, fk → `research_sources`, not null | Every finding must cite a source — enforced not-null |
| `claim_type` | text not null | e.g. `audience_size`, `event_date`, `decision_maker`, `budget_signal`, `program_fit_signal` |
| `claim_text` | text not null | Human-readable statement of the claim |
| `claim_value` | jsonb, nullable | Structured value where applicable (e.g. `{ "estimate": 1200 }`) |
| `confidence` | numeric, nullable | 0–1 |
| `origin` | text not null default `'ai_research'` | `ai_research` (produced by pipeline stage 2) or `human_provided` (came from an imported file/manual note) — keeps a human's hypothesis and the pipeline's own verification from being conflated into one unlabeled fact |
| `created_at` | timestamptz | |

### `prospect_scores`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `opportunity_id` | uuid, fk → `opportunities`, not null | |
| `pipeline_run_id` | uuid, fk → `pipeline_runs`, not null | |
| `total_score` | numeric not null | 0–100 |
| `component_scores` | jsonb not null | `{ audience_size: { score, weight, rationale, finding_ids: [] }, ... }` for all 11 components listed in `ai-workflow.md` |
| `rationale` | text not null | Overall human-readable summary |
| `confidence` | text not null | `low`, `medium`, `high` |
| `missing_information` | text[] not null default `'{}'` | Explicit gaps, shown in the queue |
| `model` | text, nullable | |
| `created_at` | timestamptz | |

Scores are immutable once created (a re-score creates a new row); the queue always shows the latest by `created_at`. This preserves history if scoring weights change later.

### `outreach_templates`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | text not null | |
| `opportunity_type_id` | uuid, fk → `opportunity_types`, nullable | Null = general-purpose template |
| `body_template` | text not null | With placeholders, e.g. `{{contact_first_name}}`, `{{opportunity_title}}` |
| `status` | text not null default `'draft'` | `draft`, `approved`, `retired` — drafting stage only uses `approved` templates |
| `created_at` / `updated_at` | timestamptz | |

### `outreach_drafts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `opportunity_id` | uuid, fk → `opportunities`, not null | |
| `contact_id` | uuid, fk → `contacts`, not null | |
| `pipeline_run_id` | uuid, fk → `pipeline_runs`, not null | |
| `template_id` | uuid, fk → `outreach_templates`, nullable | |
| `ai_subject` / `ai_body` | text, not null | Original AI output, **never overwritten** |
| `edited_subject` / `edited_body` | text, nullable | Populated only if a human edits before approving |
| `qa_flags` | jsonb, nullable | Output of the QA stage (e.g. flagged fabricated-familiarity phrases) |
| `status` | text not null default `'draft'` | `draft`, `qa_passed`, `qa_flagged`, `approved`, `approved_with_edits`, `rejected` |
| `created_at` / `updated_at` | timestamptz | |

### `approval_queue_items`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `opportunity_id` | uuid, fk → `opportunities`, not null unique | One active queue item per opportunity |
| `outreach_draft_id` | uuid, fk → `outreach_drafts`, nullable | |
| `prospect_score_id` | uuid, fk → `prospect_scores`, nullable | |
| `duplicate_warning` | boolean not null default false | Set if org or contact dedupe matched something existing |
| `status` | text not null default `'pending'` | `pending`, `approved`, `approved_with_edits`, `rejected`, `deferred`, `needs_more_research`, `duplicate` |
| `decision_notes` | text, nullable | |
| `decided_by` | text, nullable | Free-text name for v1 (see `user_preferences` note below); becomes a real fk once multi-user auth exists |
| `decided_at` | timestamptz, nullable | |
| `deferred_until` | timestamptz, nullable | For "defer" follow-up scheduling |
| `created_at` | timestamptz | |

### `outreach_activities`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `opportunity_id` | uuid, fk → `opportunities`, not null | |
| `contact_id` | uuid, fk → `contacts`, nullable | |
| `activity_type` | text not null | `approved`, `sent`, `opened`, `replied`, `bounced`, `follow_up_due`, `note` |
| `occurred_at` | timestamptz not null default now() | |
| `metadata` | jsonb, nullable | |
| `hubspot_activity_id` | text, nullable | |

### `hubspot_sync_records`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `local_entity_type` | text not null | `organization`, `contact`, `opportunity` |
| `local_entity_id` | uuid not null | |
| `hubspot_object_type` | text not null | `company`, `contact`, `note`, `deal` |
| `hubspot_object_id` | text, nullable | Null until first successful sync |
| `status` | text not null default `'pending'` | `pending`, `synced`, `error` |
| `last_synced_at` | timestamptz, nullable | |
| `last_error` | text, nullable | |
| `payload_hash` | text, nullable | For skip-if-unchanged upserts |

Unique index on `(local_entity_type, local_entity_id, hubspot_object_type)`.

### `user_preferences`
Scoped to a single implicit operator row in v1 (there's no user table to key off yet).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `owner_key` | text not null unique | `'default'` for v1; becomes a real `user_id` fk once auth exists — kept as a text key now specifically so that migration is a column rename/backfill, not a structural change |
| `daily_approval_target` | int not null default 40 | |
| `scoring_weight_overrides` | jsonb, nullable | Overrides component weights from `lib/sales/scoring/model.ts` defaults |
| `muted_organization_type_ids` | uuid[] not null default `'{}'` | |
| `created_at` / `updated_at` | timestamptz | |

## RLS

`supabase/sales-platform-rls.sql` enables RLS with **no policies** on every table in the original schema above, matching `supabase/security-enable-rls-public-tables.sql`. All access is via `supabaseAdmin` (service role) from route handlers under `/api/sales/*`. Tables added later by their own additive migration (`discovery_runs`) enable RLS inline in that same migration file instead of requiring an edit to the already-applied `sales-platform-rls.sql` — same effect, one fewer manual SQL-Editor step.
