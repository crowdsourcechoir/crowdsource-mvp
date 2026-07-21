# Roadmap

## Phased implementation

### Phase 0 — Planning (this set of documents)
Repository assessment, schema design, workflow design. No code, migrations, or packages. **Complete, pending approval.**

### Phase 1 — Seed real data, pipeline end-to-end, manual trigger (the MVP)
Goal: prove the entire staged pipeline end-to-end against real organizations, reviewed by a human, with nothing automatic and nothing sent.

- `supabase/sales-platform-tables.sql` + `sales-platform-rls.sql` (all tables from `database.md`, RLS enabled/no policies)
- One-off import scripts (`scripts/sales/import-conferences-csv.mjs`, `scripts/sales/import-fan-culture-csv.mjs`) seeding from the two provided CSVs — see `data-import.md` for the full mapping. This replaces "type in one org by hand" as the v1 data source; manual single-add in the UI still exists for adding new organizations afterward.
- Add `zod` dependency; `lib/sales/openai/` structured-output helpers
- Stages 1–10 implemented as plain functions, run sequentially by a manual "Run pipeline" action per organization (no cron yet)
- `/admin/sales/organizations` — list imported organizations, add one more by hand (name + optional website)
- `/admin/sales/organizations/[orgId]` — shows normalization result, research findings w/ sources (including imported `human_provided` findings alongside anything the pipeline verifies), detected/imported opportunities
- `/admin/sales/queue` — approval queue with all required fields visible without extra navigation, and approve / edit / reject / defer / request-more-research actions (single-item, keyboard-friendly navigation; batch actions deferred to Phase 3)
- No HubSpot sync yet — approving just marks the item approved
- **This phase directly targets the first implementation milestone below.**

### Phase 2 — Volume: top-of-funnel discovery, general CSV import UI, background processing, HubSpot
- **Built:** stage-0 organization discovery (`lib/sales/discovery/`) — nightly Vercel Cron (`vercel.json` → `/api/sales/cron/discovery`, `CRON_SECRET`-protected) plus a manual "Run discovery now" control in `/admin/sales/organizations`, finding brand-new candidate organizations via Tavily (primary) / Serper.dev (fallback) search, structured-extracted, deduped, and created with `source = 'ai_discovered'` — see `ai-workflow.md` "Stage 0" and `database.md`'s `discovery_runs` table. This is what keeps the pipeline fed with fresh organizations once the original ~280-org seeded/manually-added pool is worked through, directly answering "where do new opportunities come from every night." Requires `supabase/sales-platform-add-discovery.sql` (one-time SQL Editor run) and a `TAVILY_API_KEY` or `SERPER_API_KEY` to actually do anything — off by default (zero cost) otherwise, same contract as Phase 2's contact enrichment.
- General-purpose CSV upload UI in `/admin/sales/organizations` (Phase 1 uses one-off scripts for the two known files; this is for whatever list arrives next, from someone other than a developer)
- Vercel Cron batch endpoint (`/api/sales/pipeline/cron`) processing pending `pipeline_runs`/`agent_runs` in small batches — moves from "click run" to genuinely overnight. **Not yet built** — discovery creates organization rows nightly, but a human still triggers the existing "Run pipeline on next N unprocessed organizations" batch control to actually process them into queue items; this is the next piece needed for the whole discover→research→queue loop to run unattended end-to-end.
- HubSpot one-way sync on approval (`@hubspot/api-client`, private app token) per `architecture.md` §7
- Duplicate-warning surfacing in the queue (dedupe logic already built in Phase 1's normalization stage, now actually shown/actionable — "mark duplicate," "change contact," "change opportunity type" queue actions)
- Outreach activity tracking + follow-up timing (`outreach_activities`)

### Phase 3 — Scale the review workflow to 30–50/day comfortably
- Batch/multi-select queue actions
- Full keyboard-shortcut review flow (approve/reject/defer without leaving the keyboard)
- Scoring weight tuning UI (`user_preferences.scoring_weight_overrides`) once real score outcomes exist to tune against
- Revisit background-job approach only if Vercel Cron proves insufficient (see `architecture.md` §6)

### Phase 4 — Multi-user & beyond (not scoped in detail yet)
- Real per-user auth if more than one person needs to review/approve
- Two-way HubSpot considerations (only if a real need emerges)
- Automatic contact/organization merge assistance (still human-confirmed, just less manual lookup)

## Open questions / assumptions

1. **Auth model.** Assuming v1 stays behind the existing single-password `/admin` gate (one operator = one workspace user). If more than one person will use the queue, or "authenticated internal access only" needs to mean per-user, that changes Phase 1 scope (real auth becomes a prerequisite, not a Phase 4 nice-to-have). *Please confirm before Phase 1 starts.*
2. **Vercel plan/cron granularity.** Assuming the goal for v1 is "click to run, review results," not true unattended overnight processing — Phase 1 doesn't require frequent cron. Confirm current Vercel plan (Hobby vs. Pro) if overnight autonomy is wanted sooner, since that determines whether minute-level Cron schedules are even available.
3. **Research data sources.** Resolved for the initial seed: the two provided CSVs (`data-import.md`). Beyond that seed, own-site research (stage 2) is a targeted two-hop crawl of an org's own public website — no basic web search/news integration yet.
3a. **Contact sourcing / LinkedIn.** Resolved: the pipeline does not and will not scrape LinkedIn — its Terms of Service explicitly prohibit automated scraping, and an unauthenticated fetch (which is all this pipeline ever does) can't see real profile data anyway. Named contacts come from an org's own site (stage 4); missing emails are optionally filled in by a paid enrichment API (stage 4.5) — **Apollo.io preferred, Hunter.io automatic fallback (config-time and runtime)**, both self-serve dashboard-generated API keys (no enterprise sales process, unlike most LinkedIn-adjacent data providers). **Correction, confirmed live:** Apollo's enrichment endpoint specifically requires a paid Apollo plan — a free-plan key gets `403 API_INACCESSIBLE` on every call, contrary to the original assumption that it was free-tier-usable. Hunter.io's Email Finder endpoint genuinely is free-tier-usable (50 credits/month, verified against Hunter's docs). The code now automatically retries with Hunter at runtime if Apollo errors out and a Hunter key is present, so **if you only have a free Apollo account, also set `HUNTER_API_KEY`** — Apollo alone (free plan) will never enrich anything on its own. Off by default (zero cost) until at least one usable key is set — see `.env.example` and `ai-workflow.md` §4.5.
3b. **New-organization discovery source.** Resolved: **Tavily preferred, Serper.dev automatic fallback** — both self-serve REST search APIs with a free tier and instant dashboard API key, same self-serve bar as Apollo/Hunter. Tavily was picked as the default over Serper/Exa/Bing/Google Custom Search because its results come back pre-summarized for exactly the "hand this to an LLM" use case stage 0 needs (no separate HTML-scrape/clean step, unlike a raw SERP API), and it has the most generous no-card-required free tier of the options considered for a low-volume nightly job like this one. Off by default (zero cost, zero organizations created) until `TAVILY_API_KEY` or `SERPER_API_KEY` is set — see `.env.example` and `ai-workflow.md` "Stage 0".
4. **HubSpot object model specifics.** Assuming your HubSpot portal uses standard Company/Contact objects and doesn't require deals to be created automatically. If your HubSpot pipeline setup depends on deals being created at approval time, that's a small addition to stage 11, not a schema change.
5. **Contacts as strictly one-org-each.** v1 models `contacts.organization_id` as a single required FK. If agency/venue contacts who represent multiple organizations are common in your pipeline, that's a Phase 2+ many-to-many refinement — flagged now so it's not a surprise later, but not blocking Phase 1.
6. **"Approved email templates" authorship.** Assuming you (or someone on your team) will write/approve the initial template(s) in `outreach_templates` before drafting can run — the system doesn't invent templates from nothing. Need at least one approved general-purpose template to unblock stage 8 in Phase 1.

## First implementation milestone

**Milestone: "Seed the real data, take one organization start to finish."**

1. Run both import scripts against the two provided CSVs → ~248 organizations + opportunities from the conferences file, 32 organizations + 145 contacts from the fan-culture file, all with `import_metadata` preserved and `human_provided` research findings seeded per `data-import.md`.
2. Pick one imported organization and run the pipeline against it. The system:
   - Normalizes it and checks for duplicates against the rest of the imported set
   - Researches it and stores findings with sources — corroborating or adding to the imported `human_provided` findings, not replacing them
   - Confirms or refines its detected opportunity (already present for conference-file orgs; detected fresh for fan-culture-file orgs, which arrived with contacts but no defined opportunity)
   - Finds/verifies contacts (already present for fan-culture-file orgs; discovered fresh for conference-file orgs, which arrived with only a role hint)
   - Produces an explainable score
   - Produces a brief
   - Produces a QA'd draft email using one approved template
   - Places it in the approval queue, where all required fields are visible without extra navigation
3. Supports approve / approve-with-edits / reject / defer / request-more-research, recorded with an audit trail

**Explicitly not required for this milestone:** a general CSV-upload UI, cron/background scheduling, HubSpot sync, batch actions, or multi-user auth. Those are Phase 2+.

**Definition of done:** the two CSVs are fully imported and visible in `/admin/sales/organizations`; you can pick one real imported organization, click "Run pipeline," watch it move through all 12 stages (with visible status/errors per stage), and reach a decision in the queue on the resulting opportunity — with every claim used in the score and the email traceable to a source (imported or freshly researched).

This is deliberately the smallest slice that exercises every core design principle (evidence-before-inference, human approval, staged/inspectable AI, explainable scoring, audit trail) at once, before spending effort on volume (import/cron/HubSpot) or review-throughput polish (batch actions) that only matter once the core loop is proven correct.
