# Octo Email Marketing — Architecture and Implementation Plan

Date: 2026-09-25. Status: proposal. No application code, schema, or packages have been changed.

This plan is the concrete design for the brief in [`EMAIL_AGENT.md`](./EMAIL_AGENT.md). Another agent should be able to implement it phase by phase. Decisions marked **proposed** in that brief’s decision log need Joel’s approval before phase 1 starts.

---

## A. Existing System Assessment

Repository: `crowdsourcechoir/crowdsource-mvp`. App Router at the repo root (no `src/`).

| Area | What exists | What it means for email |
|---|---|---|
| Framework | Next.js **14.2.35**, React **18.3.1**, TypeScript strict, `@/*` path alias | Client editors must be `"use client"`. Server routes use `export const dynamic = "force-dynamic"`. |
| TipTap | `@tiptap/*` **2.27.2** already used for sales email body editing | Available for rich text *inside* a section. Not an email document format. |
| Supabase | `@supabase/supabase-js` 2.97. One service-role client, `lib/supabase-server.ts` (`supabaseAdmin`). Fetch is `cache: "no-store"` with an 8s timeout. | All new tables are read and written from route handlers and server modules. No browser Supabase client. |
| Schema | Hand-written idempotent SQL in `/supabase/*.sql`, applied in the SQL Editor. No Supabase CLI migrations. | New email tables follow that pattern. |
| RLS | Enabled to **block** anon/authenticated PostgREST. Service role bypasses RLS. Few or no policies. See `supabase/security-enable-rls-public-tables.sql` and `supabase/sales-platform-rls.sql`. | New tables get `enable row level security` and no policies. |
| Auth | Single shared password. HMAC cookie `root_auth` checked in `app/admin/layout.tsx` via `lib/root-page-auth.ts`. Middleware is a passthrough (`middleware.ts`). | `/admin/marketing` is gated. **`/api/marketing/*` is not.** Send, import, and settings routes do not check the cookie. |
| Admin chrome | `AdminShell` + `AdminSideNav` (Marketing entry already points at `/admin/marketing`). Design tokens in `lib/design-system/tokens.ts`, localStorage key `csc_design_system_v1`, CSS vars in `app/globals.css`. Settings hub: `lib/settings/catalog.ts`, contract in `docs/octo-settings-contract.md`. | New admin UI uses `.csc-list`, `.csc-eyebrow`, `.csc-btn-circle`, `var(--csc-accent)`. Email *content* tokens are a different system. |
| Jobs | Vercel Cron in `vercel.json`, `Authorization: Bearer $CRON_SECRET`, refuse if unset. Sales pipeline is time-boxed and resumable. `@vercel/functions` 3.4.3 is installed. | Reuse this. Do not add Trigger.dev or Inngest. |
| Sales mail | Gmail OAuth for 1:1 outreach. Digest transport comment in `lib/sales/digest/transport.ts` already reserves Resend for marketing. | Do not send campaigns through Gmail. Do not send sales outreach through the marketing worker. |
| Resend | `resend` **6.18.0**. Used only by `lib/marketing/email/send.ts`. Env: `RESEND_API_KEY`, kill switch `MARKETING_SENDS_ENABLED=false`. | SDK can verify webhooks. Batch API is 100 emails per request, 10 req/s team default, idempotency keys last 24 hours. |
| Storage | Signed uploads exist (`lib/songgarden/storage-upload.ts` creates a **public** bucket). Marketing JSON lives in `SUPABASE_MEDIA_BUCKET` (default `agent-media`) at `marketing/v1.json`, fetched with the service role. | Email images need a public bucket. The media bucket used for the JSON blob must not be assumed public. |

### Marketing v1 (already shipped, and why it cannot be the foundation)

`lib/marketing/` is a working prototype:

- One `MarketingStore` JSON document (`lib/marketing/types.ts`, `lib/marketing/store.ts`).
- People, tags, consent, segments, campaigns, emails, recipients, and events are arrays in that document.
- `supabase/marketing-tables-deferred.sql` is `select 1` plus a comment that SQL is optional.
- Segments are AND-only in-memory filters on `status`, `marketingConsent`, `city`, `tag`, `acquisitionSource` (`lib/marketing/segments.ts`).
- Emails are a flat `EmailBlock[]`: `hero`, `rich_text`, `image`, `cta`, `divider`, `footer`, `event`.
- HTML is hand-built tables in `lib/marketing/email/render.ts` (560px, hardcoded `#CFFF81` / black). No MJML.
- `sendMarketingEmailNow` loops `resend.emails.send` one recipient at a time inside the request, then writes the whole blob. Failures are stored as `skipped`.
- Webhook `app/api/marketing/webhooks/resend/route.ts` does not verify signatures, dedupe, or order events. Any bounce sets `bounceClass = "hard"` and status `cleaned`. Opens and clicks only increment counters.
- Unsubscribe is `GET /api/marketing/unsubscribe?email=` with the raw address (`app/api/marketing/unsubscribe/route.ts`).
- Mailchimp import is a CSV parser (`lib/marketing/ingest/mailchimp.ts`) that preserves `unsubscribed` and `cleaned` when `respectSuppression` is set. Squarespace and Facebook ingest use `x-marketing-ingest-secret`.
- Tests are a node assert script: `lib/marketing/marketing.test.ts` (segment match, CSV, render contains an unsubscribe link). There is no test runner in `package.json` scripts beyond `lint`.

Caps inside the blob: acquisition events 5,000, delivery events 5,000, recipients 20,000. An 8-second in-process cache. Concurrent webhook and send can lose updates.

### Person-shaped tables that already exist

These must not be collapsed into one table.

| Table | Identity | Email | Use |
|---|---|---|---|
| `public.contacts` | Sales prospect. `organization_id` **required**. | `email`, `normalized_email` indexed, not unique. Hunter verification status. | Gmail outreach. Not a mailing list. |
| `agent_participants` | One interview session per Bloom (`event_id` + `session_token`). | Optional `email`. Not unique. | “Attended / interviewed at event X” only when an email was collected. |
| `songgarden_clips`, `garden_participant_marks` | Device / session. | **No email column.** | Cannot define “Song Garden participants” as a mailable segment today. |
| Marketing JSON people | Email subscriber. | Required. | Prototype audience. Migrate, then stop writing. |

`events` (Blooms) have title, date, venue, hero image, slug. Marketing already reads them read-only via `lib/marketing/events-readonly.ts` for the event block. Keep that read-only boundary.

### Conventions to keep

- Feature code under `lib/marketing/` and UI under `app/admin/marketing/` + `components/marketing/`.
- API under `app/api/marketing/`, `NextResponse.json`, `{ error: string }`, camelCase in the app, snake_case in Postgres, explicit `rowToX` mappers (see `lib/events-db.ts` and `lib/sales/db/`).
- Settings master controls registered in `lib/settings/catalog.ts` and rendered with `components/settings/SettingsSubpage.tsx`.
- Workspace-level toggles that are not email content can stay in the existing marketing settings record. Audience and campaign data move to Postgres.

---

## B. Recommended Architecture

```
Admin UI (/admin/marketing, /admin/settings/email-design)
        │  edits Octo Email Document JSON + campaign fields
        ▼
lib/marketing/document     schema, migrations of schemaVersion
lib/marketing/design       token resolution
lib/marketing/render       document → MJML → HTML (server only)
lib/marketing/segments     definition JSON → parameterized SQL
lib/marketing/eligibility  subscription + suppression, called at queue and at send
lib/marketing/send         queue deliveries, claim batches, personalize, provider
lib/marketing/providers    Resend adapter (replaceable)
lib/marketing/webhooks     verify, dedupe, normalize, apply
        │
        ▼
Supabase Postgres          system of record
Supabase Storage           public email images only
Resend                     transmit + provider events
```

Responsibilities:

| Component | Owns | Does not own |
|---|---|---|
| Octo document JSON | Sections, content, token refs, personalization slots | HTML, MJML, TipTap document, Resend template id |
| Editor | Mutates the working document | Rendering rules, eligibility, sending |
| MJML compiler | Compatibility HTML for a frozen version | The editable source |
| `email_document_versions` | Immutable document + MJML + HTML + renderer version | Later edits |
| `people` | Community identity | Subscription, sales org membership |
| `communication_subscriptions` + `subscription_events` | Consent state and history | Delivery |
| `suppressions` | “Do not mail this address” | The person’s existence |
| `campaigns` | Why this communication exists, link to source campaign | Per-recipient outcome |
| `campaign_sends` | One execution: subject, schedule, frozen version, audience snapshot | The design system |
| `email_deliveries` | One recipient of one send | Raw provider payload |
| `email_events` | Append-only facts | The only copy of “opened = true” as a boolean |
| Resend | SMTP and tracking pixels/redirects | Audience, consent, analytics history |

Provider interface (one implementation in v1):

```ts
type OutboundEmail = {
  deliveryId: string;
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  idempotencyKey: string;
};

type EmailProvider = {
  id: "resend";
  sendBatch(messages: OutboundEmail[]): Promise<{
    results: Array<{ deliveryId: string; providerMessageId: string | null; error: string | null }>;
  }>;
};
```

`idempotencyKey` is `delivery:{deliveryId}` and is also sent as Resend’s `Idempotency-Key`. The delivery row is authoritative after 24 hours, when Resend forgets the key.

---

## C. Data Flow

```
person
  → communication_subscription (topic = marketing)
  → suppression check
  → segment definition (dynamic SQL or static membership)
  → campaign
  → campaign_send
  → email_document_version (frozen JSON + compiled MJML + HTML template)
  → email_deliveries (one row, status queued)
  → worker claim
  → eligibility recheck
  → personalize HTML ({{tokens}}, signed unsubscribe URL)
  → Resend batch
  → provider_message_id stored
  → Resend webhook (verified)
  → email_events (raw) + delivery status transition
  → analytics + later segment conditions
  → new campaign with source_send_id (follow-up)
```

Step by step:

1. **Identity.** An import, ingest, or admin form upserts `people` on `normalized_email` and ensures one `person_emails` row marked primary. Tags go to `person_tags`. Custom Mailchimp fields go to `people.attributes`.
2. **Consent.** The same import writes `communication_subscriptions` and an append-only `subscription_events` row. If an active suppression exists, status stays unsubscribed or is forced to unsubscribed. The person row is kept.
3. **Segment.** A saved segment stores definition JSON. Evaluation is a SQL query, not a filter over an array. “Sendable count” is that query intersected with `email_marketing_eligible(person_id)`. The segment definition is not itself a permission to send.
4. **Compose.** The editor loads `email_documents.working_document`. Saves update that JSON only. Design tokens are read from `email_design_systems` at render time unless the version snapshot inlined them (it does; see E).
5. **Version.** Preview, test, schedule, and send each insert an `email_document_versions` row: document JSON, resolved tokens, MJML, HTML with `{{tokens}}` still unreplaced, plain text, `renderer_version`. A Postgres trigger rejects updates and deletes.
6. **Queue.** Send requires root auth, `sends_enabled`, confirm phrase `SEND`, and the pre-send checks in section 17. The route inserts the send row, copies the segment definition onto the send, selects eligible people, and inserts deliveries `queued` with `unique (campaign_send_id, person_id)`. Response returns immediately with counts.
7. **Worker.** Claims up to 100 `queued` rows (`FOR UPDATE SKIP LOCKED`), sets `sending`, rechecks eligibility, personalizes, calls Resend batch, stores ids, sets `sent` or `failed`. Loops until the time budget or the queue is empty. If rows remain, it invokes itself once. A 10-minute cron resumes sends stuck in `sending`.
8. **Webhook.** Raw body verified. Insert `email_events` with unique `provider_event_id`. If the delivery is not visible yet, store `provider_message_id` and leave `delivery_id` null; a later pass links them. Status only moves forward, except terminal states (bounced, complained, failed) which win. Opens and clicks do not change delivery status. They append events and refresh derived counters.
9. **Analytics.** Counts come from deliveries and events. `campaign_sends.stats` is a cache rebuilt by `recomputeSendStats(sendId)`.
10. **Follow-up.** “No recorded open” is a new segment condition against `source_send_id`, attached to a **new** campaign. The original send stays `sent`.

---

## D. Proposed Database Schema

All tables `public`. UUID primary keys `gen_random_uuid()`. Timestamps `timestamptz not null default now()`. RLS enabled, no policies. Apply as `supabase/email-marketing-tables.sql` plus `supabase/email-marketing-rls.sql`.

Service role bypasses RLS, so immutability of versions and events is enforced with triggers, not policies.

### `people`

Community identity. One row per human we mail or might mail.

| Column | Notes |
|---|---|
| `id` | pk |
| `normalized_email` | `text not null unique`. Lowercase, trimmed. Same rule as `normalizeMarketingEmail` in `lib/marketing/ids.ts`. |
| `display_name` | `text` |
| `first_name`, `last_name` | `text` |
| `city`, `region`, `country` | `text` |
| `attributes` | `jsonb not null default '{}'` — Mailchimp merge fields and future custom fields |
| `acquisition_source` | `text not null` check in `mailchimp, squarespace, facebook, manual, import, song_garden, event, sales_link, other` |
| `created_at`, `updated_at` | |

Indexes: unique `normalized_email`; `(city)` where city is not null; `(acquisition_source)`.

Derived: nothing. Name fields are canonical. Do not also store a second copy inside `attributes` after promotion.

### `person_emails`

Allows a second address later. v1 UI edits the primary only.

| Column | Notes |
|---|---|
| `id` | pk |
| `person_id` | fk → `people` on delete cascade |
| `email` | display form |
| `normalized_email` | `text not null unique` |
| `is_primary` | `boolean not null default false` |

Partial unique index: one `is_primary = true` per `person_id`.

The primary normalized email must equal `people.normalized_email`. Application enforces that on write.

### `person_links`

Soft links to other Octo records. No cascade from those systems back into `people`.

| Column | Notes |
|---|---|
| `id` | pk |
| `person_id` | fk → `people` on delete cascade |
| `kind` | `text` check in `sales_contact, agent_participant` |
| `external_id` | `uuid not null` |
| `created_at` | |

Unique `(kind, external_id)`. Index `(person_id, kind)`.

Do not add `song_garden` until a clip or mark has an email. A link with no email cannot be mailed.

### `person_tags`

| Column | Notes |
|---|---|
| `person_id` | fk |
| `tag` | `text not null`, stored lowercase trimmed |
| `created_at` | |

Primary key `(person_id, tag)`. Index `(tag)`.

### `communication_subscriptions`

One row per person per channel per topic. v1 writes only `channel = email`, `topic = marketing`.

| Column | Notes |
|---|---|
| `id` | pk |
| `person_id` | fk |
| `channel` | `text not null` check in `email` |
| `topic` | `text not null` check in `marketing` |
| `status` | `text not null` check in `subscribed, unsubscribed, pending` |
| `consented_at`, `unsubscribed_at` | `timestamptz` |
| `updated_at` | |

Unique `(person_id, channel, topic)`.

`status` is the current value. History is `subscription_events`.

### `subscription_events`

Append-only.

| Column | Notes |
|---|---|
| `id` | pk |
| `person_id` | fk |
| `subscription_id` | fk, nullable if the event arrived before the row (should be rare) |
| `event_type` | `subscribed, unsubscribed, resubscribed, imported, pending, suppression_lifted` |
| `source` | `mailchimp_import, squarespace, facebook, admin, unsubscribe_link, complaint, hard_bounce, api` |
| `metadata` | `jsonb not null default '{}'` |
| `created_at` | |

Index `(person_id, created_at desc)`. Trigger: reject update and delete.

### `suppressions`

The send gate. Keyed by address so a suppression survives a deleted person and blocks a later re-import.

| Column | Notes |
|---|---|
| `id` | pk |
| `person_id` | fk, nullable |
| `normalized_email` | `text not null` |
| `scope` | `marketing` or `all_email` |
| `reason` | `unsubscribe, hard_bounce, complaint, manual` |
| `source` | `octo, resend, mailchimp` |
| `active` | `boolean not null default true` |
| `created_at`, `lifted_at` | |

Partial unique index: `(normalized_email, scope, reason) where active`. Index `(normalized_email) where active`.

### Eligibility

```sql
create or replace function public.email_marketing_eligible(p_person_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.people p
    join public.communication_subscriptions s
      on s.person_id = p.id
     and s.channel = 'email'
     and s.topic = 'marketing'
     and s.status = 'subscribed'
    where p.id = p_person_id
      and not exists (
        select 1
        from public.suppressions sup
        where sup.active
          and sup.normalized_email = p.normalized_email
          and sup.scope in ('marketing', 'all_email')
      )
  );
$$;
```

Hard bounce and complaint are active suppressions. There is no second `bounce_class` column to drift out of sync.

### `email_design_systems`

| Column | Notes |
|---|---|
| `id` | pk |
| `name` | `text not null` |
| `is_default` | `boolean not null default false` |
| `tokens` | `jsonb not null` — see section F |
| `created_at`, `updated_at` | |

Partial unique index: one `is_default`.

### `email_documents`

Mutable working copy.

| Column | Notes |
|---|---|
| `id` | pk |
| `kind` | `campaign` or `template` |
| `design_system_id` | fk |
| `working_document` | `jsonb not null` |
| `schema_version` | `int not null` |
| `updated_at` | |

### `email_document_versions`

Insert-only. Trigger raises on update or delete.

| Column | Notes |
|---|---|
| `id` | pk |
| `document_id` | fk. `on delete restrict` |
| `version_number` | `int not null` |
| `document` | `jsonb not null` — includes **inlined tokens** |
| `mjml` | `text not null` |
| `html` | `text not null` — placeholders intact |
| `text_plain` | `text not null` |
| `renderer_version` | `text not null` e.g. `octo-email-renderer@1;mjml@4.18.0` |
| `created_at` | |

Unique `(document_id, version_number)`.

### `email_templates`

| Column | Notes |
|---|---|
| `id` | pk |
| `name` | `text not null` |
| `description` | `text` |
| `document_id` | fk → documents where `kind = template` |
| `created_at`, `updated_at` | |

Applying a template copies `working_document` into a new `kind = campaign` document. The campaign does not keep a live pointer to the template document.

### `email_assets`

| Column | Notes |
|---|---|
| `id` | pk |
| `bucket` | `text not null` |
| `path` | `text not null` |
| `public_url` | `text not null` |
| `alt` | `text not null default ''` |
| `width`, `height` | `int` |
| `content_type` | `text not null` |
| `byte_size` | `int not null` |
| `deleted_at` | soft delete |
| `created_at` | |

Unique `(bucket, path)`.

### `campaigns`

| Column | Notes |
|---|---|
| `id` | pk |
| `name` | internal name |
| `purpose` | `text` |
| `status` | `draft, active, archived` |
| `document_id` | fk |
| `source_campaign_id` | self-fk, nullable |
| `source_send_id` | fk → `campaign_sends`, nullable |
| `created_at`, `updated_at` | |

Index `(source_send_id)`, `(status)`.

### `campaign_sends`

| Column | Notes |
|---|---|
| `id` | pk |
| `campaign_id` | fk |
| `status` | `draft, ready, scheduled, sending, sent, partially_failed, failed, cancelled` |
| `subject` | `text not null default ''` |
| `preview_text` | `text not null default ''` |
| `from_name`, `from_email`, `reply_to` | `text` |
| `segment_id` | fk, nullable for a one-off audience |
| `audience_definition` | `jsonb` snapshot copied at queue time |
| `document_version_id` | fk, required before status leaves `draft` |
| `scheduled_for` | `timestamptz` |
| `started_at`, `completed_at` | |
| `stats` | `jsonb not null default '{}'` **cache only** |
| `created_at`, `updated_at` | |

Index `(status, scheduled_for)`, `(campaign_id)`.

State machine:

- `draft` → `ready` when pre-send checks pass and a version exists.
- `ready` → `scheduled` when `scheduled_for` is set, or → `sending` when the operator confirms send.
- `scheduled` → `sending` when the safety cron sees `scheduled_for <= now()`.
- `scheduled` or `sending` → `cancelled` if the operator cancels. Worker stops claiming. Leftover `queued` deliveries become `cancelled`.
- `sending` → `sent` when no deliveries remain `queued`, `sending`, or `failed`.
- `sending` → `partially_failed` when at least one delivery is `sent` or `delivered` and at least one is `failed`.
- `sending` → `failed` when every non-suppressed delivery is `failed`.

### `email_deliveries`

| Column | Notes |
|---|---|
| `id` | pk |
| `campaign_send_id` | fk |
| `person_id` | fk |
| `to_email` | `text not null` |
| `status` | `queued, sending, sent, delivered, delayed, failed, bounced, complained, suppressed, cancelled` |
| `provider` | `text not null default 'resend'` |
| `provider_message_id` | `text` |
| `claim_token` | `uuid` |
| `claimed_at` | `timestamptz` |
| `attempt_count` | `int not null default 0` |
| `last_error` | `text` |
| `sent_at`, `delivered_at` | |
| `recorded_open_count` | `int not null default 0` **derived** |
| `first_recorded_open_at`, `last_recorded_open_at` | derived |
| `click_count` | derived |
| `first_click_at`, `last_click_at` | derived |
| `created_at`, `updated_at` | |

Unique `(campaign_send_id, person_id)`.

Partial unique `(provider, provider_message_id) where provider_message_id is not null`.

Index `(campaign_send_id, status)`, `(provider_message_id)`.

`sending` older than 10 minutes with a null `provider_message_id` is returned to `queued` by the worker (same idea as `markStalledPipelineRunsFailed`). If `provider_message_id` is already set, status becomes `sent` and is not resent.

### `email_events`

Append-only raw history. Trigger rejects update and delete.

| Column | Notes |
|---|---|
| `id` | pk |
| `delivery_id` | fk, nullable until reconciled |
| `campaign_send_id` | fk, nullable |
| `provider` | `text not null` |
| `provider_event_id` | `text not null` — Svix `svix-id` |
| `provider_message_id` | `text` |
| `event_type` | `sent, delivered, delivery_delayed, bounced, complained, opened, clicked, unsubscribed, failed, unknown` |
| `occurred_at` | from the provider when present, else receive time |
| `link_id` | fk → `email_links`, nullable |
| `url` | `text` clicked URL when unmatched |
| `payload` | `jsonb not null` trimmed provider object |
| `created_at` | |

Unique `(provider, provider_event_id)`. Index `(delivery_id, event_type)`, `(provider_message_id)`, `(campaign_send_id, event_type)`.

Status rank when applying an event:

- Forward only: `queued < sending < sent < delayed < delivered`.
- `delayed` does not block a later `delivered`.
- `bounced`, `complained`, `failed` are terminal and replace non-terminal states.
- `opened` and `clicked` never change `status`. They update the derived counters from the event table (`count(*)` and min/max `occurred_at` for that delivery).
- A duplicate `provider_event_id` inserts nothing and does not increment counters.

### `email_links`

Extracted when a version is compiled.

| Column | Notes |
|---|---|
| `id` | pk |
| `document_version_id` | fk |
| `section_id` | `text not null` |
| `href` | `text not null` |
| `label` | `text` |

Unique `(document_version_id, section_id, href)`.

Click webhooks match `payload.click.link` (Resend’s clicked URL) to `href`. Resend rewrites links when click tracking is on; store both the original href and, when the webhook includes it, the original URL field Resend sends. If matching fails, keep `email_events.url`.

### `email_test_sends`

Tests do not create deliveries or analytics.

| Column | Notes |
|---|---|
| `id` | pk |
| `campaign_id` | fk |
| `document_version_id` | fk |
| `to_email` | `text not null` |
| `provider_message_id` | `text` |
| `created_at` | |

### `segments`

| Column | Notes |
|---|---|
| `id` | pk |
| `name` | `text not null` |
| `description` | `text` |
| `kind` | `dynamic` or `static` |
| `definition` | `jsonb not null` |
| `created_at`, `updated_at` | |

### `segment_memberships`

Used when `kind = static` (a frozen audience). Dynamic segments ignore this table.

| Column | Notes |
|---|---|
| `segment_id` | fk on delete cascade |
| `person_id` | fk |
| `added_at` | |

Primary key `(segment_id, person_id)`.

### `marketing_settings`

One row. Replaces the settings object inside the JSON blob.

| Column | Notes |
|---|---|
| `id` | pk, check a single row via `singleton boolean unique default true` |
| `sends_enabled` | `boolean not null default false` |
| `from_name`, `from_email`, `reply_to` | |
| `physical_address`, `company_name` | required before a real send |
| `ingest_secret` | nullable |
| `updated_at` | |

Env `MARKETING_SENDS_ENABLED=false` still overrides `sends_enabled` at send time (existing kill switch).

### What is derived

| Field | Canonical source |
|---|---|
| Delivery open/click counters | `email_events` |
| `campaign_sends.stats` | deliveries + events, via `recomputeSendStats` |
| Segment member counts | live SQL for dynamic; `segment_memberships` for static, still intersected with eligibility at send |
| “Recorded open” in the UI | at least one `email_events` row with `event_type = opened` for that delivery |

---

## E. Email Document Architecture

### What is persisted

| Artifact | Stored | Editable |
|---|---|---|
| Octo document JSON | `email_documents.working_document` and copied onto each version | Working copy only |
| Resolved design tokens | Inlined on the version’s `document.tokens` | No. Later token edits do not change sent mail |
| MJML | On the version | No. Regenerated only for a new version |
| HTML | On the version, with `{{tokens}}` | No |
| Plain text | On the version | No |
| Per-recipient HTML | Not stored. Rebuilt from the version HTML plus delivery fields if a receipt must be shown | |

Storing MJML and HTML on the version means a future renderer change cannot rewrite history. Re-rendering a sent campaign always returns the stored HTML.

### Schema

`schemaVersion` starts at `1`. `lib/marketing/document/migrate.ts` is a pure function. Unknown versions throw. The editor refuses to save a document it cannot migrate.

```ts
type EmailDocument = {
  schemaVersion: 1;
  designSystemId: string;
  meta: { internalTitle: string };
  personalization: {
    missingTokenBehavior: "blank" | "fallback";
    fallbacks: { first_name?: string; display_name?: string };
  };
  sections: EmailSection[];
};

type EmailSection = {
  id: string; // stable, generated in the editor
  type: SectionType;
  spacing: "small" | "medium" | "large" | "xl";
  background: "canvas" | "surface" | "brand" | "ink" | "custom";
  customBackground?: string; // #rrggbb, required when background is custom
  align: "left" | "center";
  hideOnMobile: boolean;
  props: SectionProps; // discriminated union on type
};
```

`SectionType` for the full component set:

`hero | full_bleed_image | editorial_text | large_statement | image_story | two_column | pull_quote | event | song_garden_invitation | artist_feature | cta | gallery | divider | spacer | footer`

Phase 3 implements renderers for: `hero`, `full_bleed_image`, `editorial_text`, `image_story`, `cta`, `divider`, `spacer`, `footer`, `event`. The other types are valid in the schema and the editor shows them as “not available yet” if inserted early. The compiler **fails the send** if a section type has no renderer. It does not drop the section silently.

### Props (v1 renderers)

Shared image shape:

```ts
type ImageRef = {
  assetId: string | null;
  url: string; // public, copied onto the version so a later asset edit cannot change history
  alt: string;
  ratio: "portrait" | "square" | "landscape";
};
```

- **hero** — `eyebrow`, `title`, `subtitle`, `image: ImageRef | null`, `ctaLabel`, `ctaHref`.
- **full_bleed_image** — `image`, `href | null`.
- **editorial_text** — `heading | null`, `body: InlineDocument`.
- **image_story** — `image`, `imagePosition: "left" | "right"`, `heading`, `body`, `ctaLabel`, `ctaHref`. On mobile the image stacks above the text. `hideOnMobile` is separate and hides the whole section.
- **cta** — `label`, `href`, `style: "solid" | "outline"`.
- **divider** — no props.
- **spacer** — uses section `spacing` only.
- **footer** — `companyName`, `physicalAddress`, `showUnsubscribe: true`. Compiler rejects a document whose footer has `showUnsubscribe: false` or that has no footer.
- **event** — `eventId: string | null`, plus optional overrides `title`, `description`, `venue`, `date`, `href`, `ctaLabel`, `image`. At version time the server resolves the Bloom through the existing read-only helper and **inlines** the strings and image URL into the version document. Later edits to the Bloom do not change the sent email.

`InlineDocument` is a small TipTap-compatible subset stored as JSON:

```ts
type InlineDocument = {
  type: "doc";
  content: Array<
    | { type: "paragraph"; content?: InlineNode[] }
    | { type: "bulletList" | "orderedList"; content: { type: "listItem"; content: { type: "paragraph"; content?: InlineNode[] }[] }[] }
  >;
};
type InlineNode =
  | { type: "text"; text: string; marks?: Array<{ type: "bold" | "italic" | "underline" } | { type: "link"; attrs: { href: string } }> }
  | { type: "personalization"; attrs: { token: "first_name" | "display_name" | "city" | "email" } };
```

Allowed marks: bold, italic, underline, link. No font colors, no raw HTML, no images inside text. The existing TipTap packages can edit this subset. The renderer walks the JSON and emits escaped MJML. It does not pass through `rich_text.props.html` from the prototype.

Personalization tokens in subject and preview text use the same `{{first_name}}` spelling. The compiler leaves `{{token}}` in HTML. `lib/marketing/render/personalize.ts` replaces them per recipient after HTML escaping the value. `{{unsubscribe_url}}` is injected only at personalize time and is a signed URL.

### MJML mapping

The renderer emits one `mjml` document:

- `mj-body` width = token `emailWidth` (default 600).
- Each section is an `mj-section` with padding from the spacing scale and background from the token role.
- Inner content is `mj-column` at `contentWidth` (default 560). `image_story` and `two_column` use two columns. MJML `mj-group` is avoided unless a spike proves it is required; stacking on mobile is the default.
- Buttons are `mj-button` with token colors, radius, and padding.
- Images set `width` from the ratio (portrait 240, square 320, landscape 560) and `fluid-on-mobile`.
- Preview text is an `mj-preview`.
- Footer unsubscribe is an `mj-text` link whose href is `{{unsubscribe_url}}`.

`styleOverrides` are not in v1. If a section needs a one-off color, the operator uses `background: "custom"` with a hex. A later `styleOverrides` object, if added, is an allowlist (`backgroundColor`, `textColor`, `paddingY`) mapped to MJML attributes. There is no raw CSS field and no raw MJML field.

### Versioning procedure

`createDocumentVersion(documentId)`:

1. Load working document and design system.
2. Migrate schema.
3. Resolve event blocks and copy asset URLs into the JSON.
4. Inline tokens onto `document.tokens`.
5. Render MJML, compile, render plain text, extract links.
6. Insert version + link rows in one transaction.
7. Return the version id.

Campaign send stores that id. Editing the working document or the template afterward does not update the version.

### Prototype blocks

On migration, map existing JSON blocks into sections:

| Old `type` | New `type` |
|---|---|
| `hero` | `hero` |
| `rich_text` | `editorial_text` (paragraph from plain `text`; HTML dropped if it contains tags outside the allowlist) |
| `image` | `full_bleed_image` |
| `cta` | `cta` |
| `divider` | `divider` |
| `footer` | `footer` |
| `event` | `event` |

---

## F. Design System Architecture

Admin chrome (`lib/design-system/tokens.ts`) stays the admin shell. Email tokens are `email_design_systems.tokens` and are edited at `/admin/settings/email-design`, a new catalog card. The marketing settings card keeps sends, from-address, physical address, ingest secret, and the webhook URL.

Default tokens (v1, one `is_default` row):

```ts
type EmailDesignTokens = {
  schemaVersion: 1;
  emailWidth: 600;
  contentWidth: 560;
  fonts: {
    heading: "Georgia, 'Times New Roman', Times, serif";
    body: "Georgia, 'Times New Roman', Times, serif";
    ui: "Arial, Helvetica, sans-serif"; // buttons, eyebrows
  };
  type: {
    statement: { size: 40, lineHeight: 1.15, weight: 700 };
    title: { size: 32, lineHeight: 1.2, weight: 700 };
    heading: { size: 22, lineHeight: 1.3, weight: 700 };
    body: { size: 16, lineHeight: 1.5, weight: 400 };
    small: { size: 13, lineHeight: 1.5, weight: 400 };
    eyebrow: { size: 11, lineHeight: 1.4, weight: 700, tracking: 1.4 };
  };
  colors: {
    canvas: "#000000";
    surface: "#111111";
    ink: "#ffffff";
    muted: "#a1a1aa";
    brand: "#CFFF81";
    brandInk: "#000000";
    link: "#CFFF81";
  };
  spacing: { small: 16, medium: 32, large: 48, xl: 72 };
  radii: { image: 0, button: 999, card: 0 };
  button: { paddingX: 22, paddingY: 12, fontSize: 14 };
  image: { portraitWidth: 240, squareWidth: 320, landscapeWidth: 560 };
};
```

Web-safe stacks only in v1. Custom web fonts are a later decision because Outlook and Gmail proxy them inconsistently.

Background roles map to colors: `canvas`, `surface`, `brand` (brand fill, `brandInk` text), `ink` (inverted: ink fill, canvas text). `custom` uses the section hex and ink text unless contrast fails a simple luminance check, in which case the compiler warns and the pre-send check blocks send until the operator confirms.

Section controls in the inspector, not freeform CSS:

| Control | Values |
|---|---|
| Spacing | small, medium, large, xl |
| Background | canvas, surface, brand, ink, custom hex |
| Align | left, center |
| Hide on mobile | boolean |
| Image position (`image_story`) | left, right |
| Image ratio | portrait, square, landscape |
| Button style | solid, outline |

Advanced overrides are deferred. The escape hatch is a new section type with its own props, reviewed in the renderer, not a CSS box.

Footer is mandatory and always renders the physical address from the inlined tokens / settings snapshot and the unsubscribe link.

---

## G. Editor Recommendation

**Build a custom React section editor that reads and writes the Octo document. Compile with MJML on the server. Do not depend on Maily or GrapesJS in v1.**

### Maily

| Question | Finding |
|---|---|
| Stable package | `@maily-to/core` **0.3.7** (npm `latest`). Peer `react: ^18 \|\| ^19`. Depends on TipTap 2. Compatible with this app’s React 18.3. |
| Render package | `@maily-to/render` **0.2.3** uses `@react-email/components`, `@react-email/render`, and `juice`. It does not emit MJML. |
| Document | TipTap `JSONContent` (`type: "doc"`). That would be the stored source if Maily were embedded. |
| v2 | `2.0.0-beta.6` rewrites onto TipTap 3 and React **19.2** peer. A public POC reported a broken `exports.import` path (`dist/index.js` missing). Adopting it means upgrading Octo’s React and TipTap. |
| Custom blocks | Supported as TipTap nodes. Octo blocks would still serialize as Maily nodes. |
| License | MIT. |
| Maintenance | Active (v2 rewrite in progress). The rewrite is the lock-in risk: 0.3.7 is the compatible line, and it is the line about to be replaced. |
| SSR | Editor is client-only. Dynamic import with `ssr: false` would be required. |

Embedding 0.3.7 and keeping a parallel Octo schema means a bidirectional adapter. The production renderer would still be MJML, so the canvas and the iframe would be two engines. That is the drift the brief is trying to avoid.

Use Maily as a reference for inline editing, slash-style insert, and variable chips. Those interactions can be rebuilt on the TipTap subset already in the repo, inside `editorial_text` only.

### GrapesJS + MJML

| Question | Finding |
|---|---|
| Fit | `grapesjs-mjml` 1.0.8 (March 2026) renders MJML in the canvas. Closest visual match to “what will send.” |
| UX | Style manager, drag-and-drop, device preview. This is a page builder. The brief asks for an editorial tool with constrained controls. |
| React | Imperative editor mounted in `useEffect` on a DOM node React must not reconcile. Awkward next to the rest of admin. |
| Document | Grapes component JSON and/or MJML. Either one becomes the source unless a second adapter is maintained. |
| License | BSD-3-Clause. |
| Compiler | The plugin has historically bundled the MJML 4 browser build. Confirm the exact compiler before any spike. Our server pin is `mjml@4.18.0`, the last 4.x. npm `latest` is MJML **5.4.1**, which is a different compiler. Do not mix them. |

GrapesJS is the fallback if a required layout cannot be expressed as a section. It is not the v1 editor.

### MJML pin

Use **`mjml@4.18.0`** on the server. MJML 5 is current on npm and would be a separate spike. Email HTML regressions are expensive; 4.18 is the last stable 4.x line. Add `serverExternalPackages: ["mjml"]` in `next.config.js` (Next 14.2 supports this key) so the compiler is not bundled. Never import `mjml` from a client component. Preview is an API call that returns the compiled HTML for an iframe.

`mjml-browser` is not used. One compiler, on the server, for preview and send.

### Editor shape (phase 3)

- Left or top: section list, add, reorder, duplicate, delete.
- Canvas: React approximation using the same tokens (spacing, type, colors). Labeled as the editing canvas.
- Right inspector: the controls in section F plus the section’s content fields.
- Secondary pane: iframe of compiled HTML, desktop width 600 and a 375-wide mobile frame. This pane is the one that must match production.
- Text sections mount a small TipTap editor for `InlineDocument`.

The canvas is allowed to differ slightly from the iframe. The iframe is the sendable result. Pre-send uses the iframe’s HTML (the stored version), not the canvas.

---

## H. Sending and Resend Architecture

### Why the current loop stops here

`sendMarketingEmailNow` holds the request open for one HTTP call per recipient and then rewrites the entire store. A few thousand recipients exceed a serverless time limit, and a failed write loses the recipient ids needed to reconcile webhooks.

### Worker

Scale assumption: 3,000–4,000 recipients, one or two campaigns a week. 40 batch calls of 100. At a few seconds per call, one Pro invocation (`maxDuration` 300, time budget ~240s) can finish a full send if HTML is precompiled. Personalization is string replacement on the stored HTML, not 4,000 MJML compiles.

Flow:

1. `POST /api/marketing/sends/:id/start` with `{ confirmPhrase: "SEND" }`.
2. Transaction: status `sending`, insert deliveries for the eligible set, skip anyone already present (unique constraint).
3. Return `{ queued }`.
4. `waitUntil` from `@vercel/functions` starts `runSendWorker(sendId)` so the HTTP response is not held for the whole audience.
5. Worker loops: claim 100, personalize, `sendBatch`, persist. Stop at the time budget. If `queued` rows remain, `fetch` the worker route once with `CRON_SECRET`.
6. Cron `GET/POST /api/marketing/cron/send` every 10 minutes (`vercel.json`), same Bearer check as `app/api/sales/cron/pipeline/route.ts`:
   - Promote `scheduled` sends whose `scheduled_for` has passed.
   - Reset stale `sending` deliveries (no provider id, claim older than 10 minutes) to `queued`.
   - Call `runSendWorker` for any send still in `sending`.

Retries: `attempt_count` increments on claim. After 5 failures the delivery stays `failed` and the send can complete as `partially_failed`. HTTP 429 uses the `retry-after` header when present, otherwise a short backoff inside the same invocation, and does not burn all 5 attempts on one rate-limit burst. Validate each message before the batch. Resend fails the **entire** batch if one payload is invalid.

Idempotency:

- Unique `(campaign_send_id, person_id)`.
- Claim token so two workers cannot personalize the same row.
- Resend `Idempotency-Key: delivery:{id}` for 24 hours.
- If a claim expires and `provider_message_id` is set, do not call Resend again.

Cancellation sets the send to `cancelled` and updates `queued` rows to `cancelled`. Rows already `sent` stay sent.

### Webhooks

Replace the body of `app/api/marketing/webhooks/resend/route.ts`:

1. Read `await request.text()`. Do not `request.json()` first. Verification breaks if the body is reserialized.
2. `resend.webhooks.verify` with `svix-id`, `svix-timestamp`, `svix-signature`, and `RESEND_WEBHOOK_SECRET`. Missing secret returns 503. Bad signature returns 400.
3. Insert `email_events` on `(provider, provider_event_id)`. Conflict → 200 with no side effects.
4. Link delivery by `provider_message_id`. If missing, leave `delivery_id` null.
5. Apply the status rank and suppression side effects in section D.
6. Return 200 quickly. Reconciliation of unlinked events can run at the end of the handler for that message id; it does not need a second queue at this volume.

Map:

| Resend type | Octo `event_type` | Side effect |
|---|---|---|
| `email.sent` | `sent` | status forward to `sent` |
| `email.delivered` | `delivered` | status forward to `delivered` |
| `email.delivery_delayed` | `delivery_delayed` | status `delayed` unless already `delivered` or terminal |
| `email.bounced` | `bounced` | status `bounced`; suppression `hard_bounce` only when the payload says permanent / hard. Soft bounces set `delayed` or `failed` and do **not** suppress. |
| `email.complained` | `complained` | status `complained`; suppression `complaint`; subscription `unsubscribed`; subscription event |
| `email.opened` | `opened` | counters only. UI copy: “Recorded open”. |
| `email.clicked` | `clicked` | counters + `link_id` when matched |
| `email.failed` | `failed` | status `failed` |

Open and click tracking stay enabled on the Resend domain so webhooks fire. Octo still stores the events. Resend’s 30-day dashboard retention is irrelevant because the rows live in Postgres.

Do not create Resend Contacts, Audiences, Topics, or Broadcasts. Those features would move consent and audience into Resend. The batch email API is the integration.

### Test sends

`email_test_sends` + one `emails.send` (not batch). Subject prefixed `[TEST]`. Uses a real compiled version so the test matches production HTML. Unsubscribe URL in a test points at a preview token that does not change a subscription, or at the operator’s own address with a clearly marked test footer. It must not use the production unsubscribe side effect accidentally: personalize with `unsubscribeUrlMode: "test"`.

---

## I. Subscription and Suppression Model

### States

| Concern | Where it lives |
|---|---|
| Subscribed / unsubscribed / pending | `communication_subscriptions.status` |
| How that status was reached | `subscription_events` |
| Do not email, including bounce and complaint | `suppressions` |
| Per-send outcome | `email_deliveries` |

Unsubscribe does not delete `people`, `person_links`, or sales `contacts`.

### Unsubscribe

Token: HMAC-SHA256 over `personId.subscriptionId` with `MARKETING_UNSUBSCRIBE_SECRET` (dedicated env, not the Resend key). URL: `/api/marketing/unsubscribe?token=`.

- `GET` shows a confirmation page and performs the unsubscribe (mail clients issue GET). The page does not echo the address in full if it can be avoided; the current handler reflects the email in HTML.
- `POST` supports RFC 8058 one-click (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`).
- Headers on every marketing message: `List-Unsubscribe: <url>` and `List-Unsubscribe-Post`.

Effect, in one transaction: subscription `unsubscribed`, `unsubscribed_at` set, subscription event `unsubscribed` / `unsubscribe_link`, active suppression `reason = unsubscribe`, `scope = marketing`.

### Re-subscribe

Admin action only in v1. Sets subscription `subscribed`, writes `resubscribed`, lifts active suppressions whose `reason = unsubscribe`. Does not lift `hard_bounce`, `complaint`, or `manual`. Those have a separate “lift suppression” control that writes `suppression_lifted` and requires the operator to type the address.

### Imports and ingest

`respectSuppression` becomes the default and is not optional for Mailchimp, Squarespace, or Facebook. An active suppression or an existing `unsubscribed` status is preserved. A new person with Mailchimp status `unsubscribed` or `cleaned` is created as a person, subscription `unsubscribed`, and a suppression (`unsubscribe` or `hard_bounce`). `cleaned` maps to `hard_bounce`. `pending` / transactional stays `pending` and is not mailable.

Squarespace and Facebook keep the shared ingest secret, now read from `marketing_settings`.

### Transactional vs marketing

Marketing sends go through this worker and the eligibility function. Sales Gmail, the morning digest, and any future Bloom receipt do not. They also do not consult `topic = marketing`. A later transactional mailer must still honor `scope = all_email` suppressions (complaints and hard bounces) and must not honor marketing unsubscribes.

### Resend’s own suppression list

Webhooks keep Octo aligned when Resend drops a bounce or complaint. The worker also refuses ineligible rows so a bug cannot remail them. Do not push the audience into Resend in order to use Resend’s contact-level suppression.

### Compliance that affects the schema

- **CAN-SPAM:** physical postal address in the footer (`marketing_settings.physical_address` snapshotted onto the version), a working unsubscribe that does not require a login, honor immediately (the 10-day rule is the legal ceiling, not the product behavior), truthful from-name.
- **One-click:** `List-Unsubscribe` + POST, already above.
- **CASL (if any Canadian subscribers):** record `source` and `consented_at` on the subscription event. Express consent from Mailchimp import is `source = mailchimp_import`, not a fresh opt-in.
- **GDPR-style deletion:** a later erase flow anonymizes `people` email fields and keeps suppression on a hash, so the address cannot be re-imported and historical delivery counts remain. v1 does not implement erasure. v1 must not make it impossible: events reference `person_id` and `delivery_id`, not a copied biography.
- **Secrets in links:** the current raw-email unsubscribe lets anyone unsubscribe anyone else and leaks addresses into logs. The signed token replaces it.

Pre-send checks (server, not just UI):

- Root auth.
- `sends_enabled` and env kill switch.
- From address present and non-empty.
- Physical address and company name present.
- Document has a footer with unsubscribe.
- Version exists and matches the working document hash the operator previewed (store `previewed_version_id` on the send when they open compiled preview; send refuses if the working copy changed afterward).
- Eligible count > 0.
- Every image URL is `https` and points at `email_assets.public_url` or an already-inlined permanent URL.
- Every link is absolute `http` or `https`.
- Confirm phrase `SEND`.
- Operator sees eligible count, suppressed count, and missing-token count before the phrase is accepted.

---

## J. Mailchimp Migration Plan

Do this before the first production campaign if the live audience is still in Mailchimp. The CSV importer can land in phase 1. Historical campaign stats wait until deliveries exist (phase 6).

### Import

Source: Mailchimp audience export CSV (already partially parsed). API import is unnecessary for a one-time 4,000-row audience unless the CSV is missing columns.

Map:

| Mailchimp | Octo |
|---|---|
| Email Address | `people` + primary `person_emails` |
| First Name, Last Name, or merge name | `first_name`, `last_name`, `display_name` |
| Address / city / state / country merge fields | columns when recognized, else `attributes` |
| Tags | `person_tags` |
| Groups / interests | tags prefixed `group:` unless Joel names specific groups that should become segment definitions |
| Status `subscribed` | subscription subscribed, event `imported` |
| Status `unsubscribed` | person kept, subscription unsubscribed, suppression `unsubscribe` / `mailchimp` |
| Status `cleaned` | suppression `hard_bounce` / `mailchimp` |
| Status `pending` | subscription `pending`, not mailable |
| Member ID | `people.attributes.mailchimp_id` |
| `CONFIRM_TIME` / opt-in timestamp if present | `subscription_events.metadata` and `consented_at` |
| Other merge fields | `people.attributes` under their merge tag |

`MEMBER_RATING`, campaign open counts, and click counts from the list export are optional attributes. They are not `email_events`. They must not satisfy “recorded open” for a follow-up segment. Label them `mailchimp_historical` in `attributes` if kept.

### Order of operations

1. Phase 1 tables exist.
2. Dry-run the CSV: counts by status, duplicate emails, missing emails.
3. Import with suppression preservation.
4. Compare counts to Mailchimp: subscribed, unsubscribed, cleaned.
5. Send a test to an internal address.
6. Only then pause Mailchimp campaigns so two tools do not mail the same list.
7. Keep the Mailchimp export file outside the repo.

### Existing JSON blob

If `marketing/v1.json` in the `agent-media` bucket (or `.data/marketing-v1.json`) contains people, a one-shot script maps them with the same suppression rules, keyed by `normalized_email`, so a later Mailchimp import updates rather than duplicates. After cutover the app does not write the blob. Leave the object in Storage as an archive.

### What not to import

Mailchimp templates, HTML campaigns, and automations. Rebuild the few live templates as Octo documents. Historical Mailchimp campaign reports can be a CSV attached to notes later; they do not become `campaign_sends` unless someone needs behavioral segments against pre-Octo campaigns. Default: do not import them. Record that as an open decision in section M.

---

## K. Implementation Phases

Each phase leaves `/admin/marketing` usable. Do not run two writers (JSON blob and Postgres) after phase 1.

### Phase 1 — Foundation (first build)

Postgres model, eligibility, segment compiler for attributes/tags/subscription, settings row, document + version tables with triggers, migration of the JSON blob, root-auth on marketing mutations, existing screens pointed at Postgres.

Does not include MJML, the new editor, or the batch worker. The current block editor can keep saving, but it saves a `schemaVersion: 1` document (section E mapping) instead of the old `blocks` array. Sending stays paused (`sends_enabled` default false) until phase 4. If a send route still exists, it returns 409 `Sending moves to the queue in phase 4` rather than looping Resend.

### Phase 2 — Rendering

MJML renderer, pinned compiler, compiled preview endpoint, plain text, link extraction, snapshot tests per section type. Preview iframe on the existing campaign screen.

### Phase 3 — Composition

Design-system settings page. Section editor and inspector. Asset upload. Templates. Remaining section types (`large_statement`, `pull_quote`, `two_column`, `gallery`, `song_garden_invitation`, `artist_feature`) as soon as their renderers and controls exist; they can trail the first nine types by a commit but should not invent a second document shape.

### Phase 4 — Delivery

Queue, worker, safety cron, Resend batch, verified webhooks, test send, schedule, pre-send checks, signed unsubscribe. This is the first phase allowed to mail the list.

### Phase 5 — Engagement

Analytics from events. Behavioral segment conditions. “Create follow-up” producing a new campaign + segment. Contact history on the person page.

### Phase 6 — Mailchimp history (optional)

Only if pre-Octo opens and clicks must drive segments. Otherwise phase 1’s CSV import is the whole migration.

Dependency order: 1 → 2 → 3 and 4 can overlap after 2 (delivery can send a document produced by the phase 2 compiler even before the fancy editor). 5 requires 4. Real audience import (part of 1, operationally before 4) requires suppression rules from 1.

---

## L. File-Level Implementation Map

### Phase 1 — create

| Path | Role |
|---|---|
| `supabase/email-marketing-tables.sql` | Tables, indexes, eligibility function, immutability triggers |
| `supabase/email-marketing-rls.sql` | `enable row level security` |
| `lib/marketing/db/client.ts` | Reuse `supabaseAdmin`; throw a clear error when null |
| `lib/marketing/db/people.ts` | Upsert, list, get |
| `lib/marketing/db/subscriptions.ts` | Status changes + events + suppressions |
| `lib/marketing/db/segments.ts` | CRUD |
| `lib/marketing/db/documents.ts` | Working copy + insert version |
| `lib/marketing/db/campaigns.ts` | Campaign + draft send |
| `lib/marketing/db/settings.ts` | Singleton settings |
| `lib/marketing/document/types.ts` | Section union |
| `lib/marketing/document/schema.ts` | Zod parse |
| `lib/marketing/document/migrate.ts` | `schemaVersion` switch; legacy block adapter |
| `lib/marketing/segments/definition.ts` | Types for definition JSON |
| `lib/marketing/segments/compile.ts` | JSON → SQL (`match: "all"` only) |
| `lib/marketing/eligibility.ts` | Calls the SQL function; used by segment counts |
| `lib/marketing/auth.ts` | `requireRootPageAuth(request)` using `ROOT_AUTH_COOKIE_NAME` |
| `lib/marketing/migrate-json-store.ts` | One-shot read of `marketing/v1.json` |
| `scripts/marketing/migrate-json-store.mjs` | Operator entry point |
| `lib/marketing/db/*.test.ts` or extend `lib/marketing/marketing.test.ts` | Pure tests for compile, eligibility rules, legacy adapter, CSV |

### Phase 1 — change

| Path | Change |
|---|---|
| `app/api/marketing/audience/route.ts` | Read/write `people` |
| `app/api/marketing/audience/import/route.ts` | CSV → new upsert, always preserve suppression |
| `app/api/marketing/segments/route.ts` | Persist definition JSON |
| `app/api/marketing/campaigns/route.ts` and `[id]/route.ts` | Documents + sends |
| `app/api/marketing/settings/route.ts` | `marketing_settings` |
| `app/api/marketing/ingest/squarespace/route.ts` and `facebook/route.ts` | New upsert; secret from settings |
| `app/api/marketing/unsubscribe/route.ts` | Accept legacy email param only until tokens exist; phase 4 replaces the effect |
| `app/api/marketing/emails/[id]/actions/route.ts` | Preview can stay on the old renderer for phase 1; **send returns 409** |
| `components/marketing/*` | Load the same screens from the new API shape. Minimal edits so lists still render |
| `lib/settings/catalog.ts` | No new card yet. Phase 3 adds `email-design` |
| `lib/marketing/ingest/mailchimp.ts` | Target the new upsert. Keep the CSV parser |

### Phase 1 — stop using after migration

| Path | Fate |
|---|---|
| `lib/marketing/store.ts` | Called only by the migrator, then unused. Delete in a follow-up once production is confirmed migrated |
| `supabase/marketing-tables-deferred.sql` | Replace the comment with a pointer to the new SQL file, or leave it untouched so old runbooks do not execute a destructive script. Do not put the real DDL there |

### Phase 2 — create

| Path | Role |
|---|---|
| `lib/marketing/render/tokens.ts` | Resolve and inline tokens |
| `lib/marketing/render/blocks/*.ts` | One file per section type, returns MJML fragments |
| `lib/marketing/render/compile.ts` | Assemble MJML, call `mjml2html`, plain text, links |
| `lib/marketing/render/personalize.ts` | Token replacement |
| `lib/marketing/render/snapshots/*.html` | Expected HTML fixtures |
| `app/api/marketing/documents/[id]/preview/route.ts` | Auth, returns `{ html, text, errors }` |

### Phase 2 — change

| Path | Change |
|---|---|
| `package.json` | Add `mjml@4.18.0` only when this phase starts |
| `next.config.js` | `serverExternalPackages: ["mjml"]` |
| `lib/marketing/email/render.ts` | Becomes a thin wrapper or is deleted once callers use `compile.ts` |
| `components/marketing/MarketingCampaignEditorClient.tsx` | Iframe preview hits the new endpoint |

### Phase 3 — create

| Path | Role |
|---|---|
| `app/admin/settings/email-design/page.tsx` | Settings subpage |
| `components/settings/EmailDesignSettingsClient.tsx` | Token editor |
| `components/marketing/editor/EmailEditor.tsx` | Section stack |
| `components/marketing/editor/Inspector.tsx` | Controls |
| `components/marketing/editor/InlineTextEditor.tsx` | TipTap subset |
| `app/api/marketing/assets/prepare/route.ts` | Signed upload |
| `app/api/marketing/assets/confirm/route.ts` | Insert `email_assets` |
| `lib/marketing/assets/storage.ts` | Public bucket `email-assets`, patterned on `lib/songgarden/storage-upload.ts` |
| `app/api/marketing/templates/route.ts` | List and apply |

### Phase 3 — change

| Path | Change |
|---|---|
| `lib/settings/catalog.ts` | Card `email-design`, status `live`, controls listed in section F |
| `components/marketing/MarketingCampaignEditorClient.tsx` | Host the new editor |

### Phase 4 — create

| Path | Role |
|---|---|
| `lib/marketing/providers/types.ts` | `EmailProvider` |
| `lib/marketing/providers/resend.ts` | Batch send |
| `lib/marketing/send/queue.ts` | Insert deliveries |
| `lib/marketing/send/worker.ts` | Claim, personalize, send, finish |
| `lib/marketing/send/checks.ts` | Pre-send checks |
| `lib/marketing/unsubscribe.ts` | Sign and verify tokens |
| `app/api/marketing/sends/[id]/start/route.ts` | Confirm and queue |
| `app/api/marketing/sends/[id]/cancel/route.ts` | Cancel |
| `app/api/marketing/cron/send/route.ts` | Safety + schedule |
| `app/api/marketing/emails/[id]/test/route.ts` | Test send |

### Phase 4 — change

| Path | Change |
|---|---|
| `app/api/marketing/webhooks/resend/route.ts` | Verify, dedupe, normalize |
| `app/api/marketing/unsubscribe/route.ts` | Token + POST |
| `vercel.json` | One cron: `/api/marketing/cron/send` at `*/10 * * * *` |
| `.env.example` | `RESEND_WEBHOOK_SECRET`, `MARKETING_UNSUBSCRIBE_SECRET` |
| `lib/marketing/email/send.ts` | Delete the per-recipient loop once the worker is live |

### Phase 5 — create

| Path | Role |
|---|---|
| `lib/marketing/stats.ts` | `recomputeSendStats` |
| `lib/marketing/segments/behavior.ts` | Extra SQL fragments: recorded open, click, link, delivery |
| `app/admin/marketing/campaigns/[id]/report/page.tsx` | Or extend the existing analytics screen |
| `app/api/marketing/people/[id]/history/route.ts` | Deliveries + events for one person |
| `app/api/marketing/campaigns/[id]/follow-up/route.ts` | New campaign + segment from a behavior preset |

### Phase 5 — change

| Path | Change |
|---|---|
| `components/marketing/MarketingAnalyticsClient.tsx` | Read stats from Postgres. Label “Recorded opens”. |
| `components/marketing/MarketingSegmentsClient.tsx` | Behavior conditions |
| `lib/marketing/segments/compile.ts` | Accept the behavior condition types |

### Do not change

- `public.contacts` and sales send paths.
- `lib/sales/digest/transport.ts` (Resend stays marketing-only).
- Gardens, Blooms, and Song Garden tables, except a future optional email on participation (out of v1).
- Admin chrome tokens.

### Auth scope

Add `requireRootPageAuth` to every `/api/marketing` handler except:

- `unsubscribe` (public, token)
- `webhooks/resend` (public, Svix)
- `ingest/*` (secret header)
- `cron/send` (`CRON_SECRET`)

This is stricter than today’s sales API routes, which are also unauthenticated. Do not boil that ocean in this project. Do close it for marketing because the new routes can mail thousands of people.

---

## M. Risks and Decisions Required

Approve these before implementation. The plan’s recommendations are in the decision log.

1. **`people` vs sales `contacts`.** Recommended: new `people` table. Needs an explicit yes because the brief says one canonical person. The inspection found that `contacts` cannot be that table without pulling choir subscribers into the sales queue.
2. **Editor.** Recommended: custom sections + MJML 4.18, Maily not installed. This changes the brief’s “current preferred direction.” Needs an explicit yes.
3. **MJML major.** Recommended pin `4.18.0`. MJML 5.4.1 is npm latest. Switching majors later means a new `renderer_version` and new snapshots, not a rewrite of the document.
4. **Production blob.** Confirm whether `marketing/v1.json` has real subscribers. If it does, phase 1 migrates it before turning off the blob writer. If it does not, the migrator no-ops.
5. **Resend domain.** Confirm the verified from-address, reply-to, and that open/click tracking are enabled on that domain. The plan does not provision DNS.
6. **Postal address.** Required in settings before phase 4 send. It is not in the repo.
7. **Mailchimp history.** Default is status, tags, and merge fields only. Say if pre-Octo opens and clicks must become segments.
8. **Song Garden segment.** Impossible until participation stores an email. The condition type can exist and return no one. Do not fake it by joining `device_id`.
9. **Event attendance.** Only `agent_participants.email` can match. Many sessions have no email. The segment copy should say “interview email on this Bloom,” not “everyone who attended.”
10. **API auth gap.** Phase 1 closes it for marketing. The rest of `/api/*` remains open behind the admin UI only. That is existing Octo practice, not a new risk introduced by this plan, but send routes must not follow it.
11. **Cron quota.** `vercel.json` already has many sales schedules. Adding one `*/10` job is the proposal. If the Vercel plan rejects it, the chained worker still finishes a send; the cron is the resume path. Do not add a per-minute cron.
12. **Webhook bounce shape.** Implementers must branch on Resend’s hard vs soft bounce field when coding phase 4. Treating every bounce as a hard suppression (current code) will shrink the list incorrectly.
13. **Single operator.** Permissions are “root cookie or not.” There is no role for “edit but not send.” The confirm phrase is the extra gate. Multi-user roles are out of scope.

Assumptions stated so they are not silent:

- Audience stays in the low thousands and cadence stays weekly.
- One marketing topic.
- One default design system.
- English copy.
- Service-role server access only.
- Hand-applied SQL files.
- Gmail remains sales. Resend remains marketing bulk.
- No new job SaaS.
- Images are jpeg, png, or gif, public, permanent. SVG rejected. WebP allowed with a warning in the asset UI.
- Sent asset objects are not hard-deleted. Library rows soft-delete only when no version JSON contains the URL; v1 can skip garbage collection entirely.

---

## N. Recommended First Build Phase

Phase 1 only, after the decisions in M.1 and M.2 are accepted.

**Outcome:** Octo has a real audience database with consent and suppression, campaigns and documents stored as rows, segment queries that run in SQL, and the current Marketing screens reading that data. Nothing is mailed.

**Build:**

1. SQL files in section D, including eligibility and insert-only triggers for `email_document_versions`, `subscription_events`, and `email_events`.
2. DB modules and the document schema (Zod + legacy block adapter).
3. Segment compiler for `match: "all"` and condition types `attribute` (`city`, `region`, `country`, `acquisition_source`), `tag`, and `subscription`. Reject unknown condition types with an error. Do not partially match.
4. Point audience, import, segments, campaigns, settings, and ingest routes at Postgres. Require root auth on those routes except ingest.
5. Campaign save writes `working_document` sections. The existing editor fields (subject, the seven block forms) map through the adapter so the screen still saves.
6. `actions` send returns 409. Test send returns 409. Preview may keep the current HTML renderer until phase 2.
7. Migrator script for the JSON blob, idempotent on `normalized_email`.
8. Tests listed in the testing section below, runnable with `node --experimental-strip-types` or the project’s current plain `node` assert style (`lib/marketing/marketing.test.ts`). No new test framework.

**Do not build in phase 1:** MJML, Maily, asset bucket, worker, webhook rewrite, analytics, follow-up UI, Mailchimp historical campaigns.

**Done when:**

- A Mailchimp CSV with one unsubscribed row and one subscribed row imports, and a second import cannot flip the unsubscribed row to subscribed.
- A Seattle + tag segment returns the right count from SQL.
- `email_marketing_eligible` is false for unsubscribed, pending, hard bounce, and complaint.
- Updating an `email_document_versions` row fails in Postgres.
- `/admin/marketing` audience and campaign screens load against the new API.
- Unauthenticated `POST /api/marketing/campaigns` returns 401.
- `marketing/v1.json` is not written by the app.

---

## Testing Strategy

High-risk behavior is mostly pure or database-level. Prefer those tests over component snapshots.

| Risk | Test |
|---|---|
| Document → MJML → HTML | Fixture per section type. Assert unsubscribe href placeholder, no raw `<script>`, image alt present, button href escaped. Phase 2. |
| Schema migrate | Legacy `blocks` fixture becomes `schemaVersion: 1`. Unknown version throws. |
| Segment SQL | Attribute, tag, subscription, and (phase 5) behavior fixtures. Unknown operator rejected. |
| Suppression | Import, webhook complaint, unsubscribe, re-subscribe, and “lift bounce” table-driven cases. |
| Unsubscribe enforcement | Queue includes a person; suppression is inserted before the worker claims; delivery becomes `suppressed` and the provider mock is not called. |
| Dedup | Two queue calls for one send insert one delivery. |
| Version immutability | Integration test against a database, or a SQL test run in the SQL editor and checked in as a comment with the expected error. The trigger is the product. |
| Webhook idempotency | Same `svix-id` twice → one event, counters unchanged. |
| Webhook order | `delivered` then `sent` stays `delivered`. `opened` does not set `delivered`. Soft bounce does not insert `hard_bounce`. |
| Failed send | Provider error sets `failed`, increments `attempt_count`, retry succeeds once. Fifth failure sticks. |
| Personalization | Missing `first_name` uses fallback or blank per document. Values containing `<` are escaped. `{{unsubscribe_url}}` differs per person. |
| Permissions | Mutation routes 401 without the cookie. Cron 401 without `CRON_SECRET`. Webhook 400 on a bad signature. |
| Pre-send | Missing physical address, missing footer, and stale preview version each block start. |

Integration tests that need Supabase are more valuable than unit tests for the trigger, the eligibility function, and `SKIP LOCKED` claims. If CI has no database, keep the SQL function’s logic duplicated in a pure TypeScript predicate used by tests **and** call the SQL function from the app so production has one gate. The TypeScript predicate is a test double, not a second implementation the worker may choose. The worker calls SQL only.

The provider is mocked in tests. No test hits Resend.

---

## Segment definition (normative)

```json
{
  "schemaVersion": 1,
  "match": "all",
  "conditions": [
    { "type": "attribute", "field": "city", "op": "eq", "value": "Seattle" },
    { "type": "tag", "op": "has", "value": "conference" },
    { "type": "subscription", "topic": "marketing", "status": "subscribed" },
    { "type": "behavior", "sendId": "uuid", "signal": "recorded_open", "op": "none" },
    { "type": "behavior", "sendId": "uuid", "signal": "click", "op": "none" },
    { "type": "behavior", "sendId": "uuid", "signal": "click", "linkId": "uuid", "op": "exists" },
    { "type": "relation", "relation": "event_participant", "eventId": "uuid", "op": "exists" }
  ]
}
```

Phase 1 compiler accepts `attribute`, `tag`, and `subscription` with `op` of `eq` or `has`. Phase 5 adds `behavior` and `relation`. `match: "any"` and nested groups are reserved: the parser accepts only `match: "all"` and a flat `conditions` array until a later version. Adding `or` later is a new `schemaVersion` or an additional key, not a rewrite of stored rows that only use `all`.

`relation: event_participant` joins `person_links` or, when no link exists, `agent_participants.email` normalized to `people.normalized_email` for that `event_id`. `relation: song_garden_participant` is rejected with a clear error until an email exists on participation.

Static segments copy person ids into `segment_memberships` at save or at “freeze.” A campaign send copies the definition JSON onto the send and materializes **deliveries**, which are the audience that was actually attempted. Later segment edits do not change those rows.

Eligibility is always a separate `and email_marketing_eligible(people.id)` on queue and on claim. It is not a segment condition the operator can delete.
