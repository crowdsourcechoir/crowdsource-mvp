# Octo Email Agent

Persistent product and architecture brief for the Octo email marketing system.

Implementation plan (inspection of this repository, 2026-09-25): [`architecture-plan.md`](./architecture-plan.md).

Joel accepted M.1 and M.2 by asking to build Phase 1 (2026-09-25). That build also accepts Postgres as the system of record. Later-phase entries in the decision log stay proposed. Phase 1 code stores the audience in Postgres and does not send mail. Apply `supabase/email-marketing-tables.sql` and `supabase/email-marketing-rls.sql` in the Supabase SQL Editor before this branch reaches production.

---

# Product Vision

Octo should become the primary system for managing:

- contacts
- audiences
- email subscriptions
- segmentation
- email creation
- campaigns
- delivery
- engagement
- analytics
- behavioral follow-up
- resends

Mailchimp is being replaced primarily to:

1. reduce recurring software costs,
2. eliminate a disconnected marketing database,
3. integrate communications with the rest of Octo,
4. own the underlying audience and engagement data,
5. create a significantly better email-design experience.

The objective is **not to reproduce every Mailchimp feature**.

Build the functionality actually needed while creating a strong architectural foundation for future capabilities.

---

# Core Architecture

The intended division of responsibility is:

## Octo

Application and orchestration layer.

Octo owns:

- campaign workflows
- audience selection
- segmentation
- email creation UX
- sending logic
- permissions
- analytics
- behavioral targeting
- business rules

## Supabase

Primary database and system of record.

Supabase should own canonical data for:

- contacts
- contact attributes
- subscriptions
- consent
- suppressions
- audiences/segments
- email documents
- templates
- campaigns
- campaign versions
- recipient deliveries
- engagement events
- tracked links
- analytics source data

## Resend

Email delivery infrastructure.

Resend is responsible for:

- transmitting email
- delivery infrastructure
- provider-level tracking
- delivery events
- open events
- click events
- bounce events
- complaint events

Resend should **not** become Octo's canonical audience or campaign database.

Treat Resend as replaceable infrastructure.

## Email Editor

The visual editor is the composition interface.

The current leading candidate is **Maily**, potentially extended or adapted for Octo.

The editor must also remain replaceable.

It must not define the canonical architecture of the email system.

## MJML

MJML is the intended email rendering/compatibility layer.

Conceptually:

Octo Email Document  
→ Visual Editor  
→ MJML  
→ Compiled email-safe HTML  
→ Resend

---

# Foundational Principle: Octo Owns the Document

Do not make Maily, GrapesJS, MJML, Resend, or generated HTML the canonical representation of an email.

Octo should own a structured, versioned **Email Document**.

The document should describe the email semantically:

- sections
- layout
- content
- components
- imagery
- typography
- styling
- links
- personalization
- responsive behavior
- design-system references

The visual editor manipulates this document.

The rendering layer converts it into MJML.

MJML produces production HTML.

The HTML is sent through Resend.

This separation is intentional.

It allows Octo to replace or substantially change the visual editor later without rebuilding the marketing system.

---

# Design Is a Primary Requirement

Email design is not secondary polish.

One of the project's explicit objectives is to provide **better design capabilities than Mailchimp**.

The editor should ultimately feel more like a lightweight design/editorial tool for email than a conventional marketing-template builder.

The system should provide substantial control over:

- typography
- hierarchy
- spacing
- imagery
- alignment
- backgrounds
- columns
- section composition
- buttons
- dividers
- image treatments
- content width
- visual rhythm
- mobile behavior

However, this freedom must remain compatible with the limitations of HTML email.

Do not sacrifice reliable rendering in major email clients for arbitrary web-design freedom.

---

# Email Design System

Octo should have a first-class email design system rather than styling each campaign independently.

The design system should support global tokens such as:

- email width
- content width
- typography
- type scale
- line height
- colors
- spacing scale
- backgrounds
- borders
- radii
- button styles
- link styles
- image treatments
- section spacing

Emails should use reusable editorial components rather than relying exclusively on generic blocks.

Potential components include:

- Hero
- Full-Width Image
- Editorial Text
- Large Statement
- Image + Story
- Two-Column Feature
- Pull Quote
- Event
- Song Garden Invitation
- Artist Feature
- CTA
- Gallery
- Divider
- Spacer
- Footer

These components should expose **meaningful design controls**.

For example:

Image Position:
- left
- right

Image Ratio:
- portrait
- square
- landscape

Section Spacing:
- small
- medium
- large
- extra large

Background:
- brand
- light
- dark
- custom

Advanced controls may exist where useful, but arbitrary CSS should not be the primary editing model.

---

# Contacts Are People, Not Mailchimp Subscribers

Avoid creating a separate silo of "email people."

Octo should maintain a canonical contact/person model.

Email marketing data attaches to that identity.

A contact may eventually be associated with:

- contact information
- organizations
- projects
- events
- Song Garden participation
- geographic information
- tags
- interests
- communications
- campaign history
- engagement

Email subscription state is an attribute/relationship associated with the contact, not the contact's reason for existing.

An unsubscribe must therefore **not delete the contact**.

---

# Subscription and Consent

Subscription state must be modeled explicitly.

The architecture should support:

- subscribed
- unsubscribed
- suppression
- bounce
- complaint
- consent/source history
- re-subscription
- future communication preferences

Future versions may distinguish different subscription categories.

Transactional and marketing communication should remain conceptually distinct.

Most importantly:

**Subscription and suppression rules must be enforced server-side immediately before sending.**

Never assume that because a contact was included in an audience earlier they remain eligible to receive the message.

---

# Audiences and Segmentation

Octo should eventually support audiences based on both contact data and behavior.

Examples:

Seattle contacts

Song Garden participants

Conference contacts

People tagged with a particular interest

People who received Campaign A

People who received Campaign A but have no recorded open

People who opened Campaign A but did not click

People who clicked a specific CTA

People who attended an event and are subscribed

Segments may be:

- one-time
- reusable
- dynamic

The segment architecture should support increasingly sophisticated conditions without requiring database redesign.

---

# Campaign Model

Keep these concepts distinct:

**Design System**

Defines visual rules.

**Template**

Reusable starting structure.

**Email Document**

Editable content/design.

**Email Document Version**

Immutable snapshot of an email.

**Campaign**

Marketing communication and its business context.

**Campaign Send**

A particular execution of that campaign.

**Delivery**

The message sent to one recipient.

**Event**

Something that subsequently happened to that delivery.

Do not collapse these concepts into one database record.

---

# Versioning

Versioning is important.

Once an email has been sent, Octo must retain the exact content that was delivered.

Editing a template later must not change historical campaigns.

Editing a document after sending must not change the historical record of what recipients received.

The system should therefore preserve immutable document versions associated with campaign sends.

---

# Delivery Model

Every campaign recipient should have an individual delivery record.

Conceptually:

Campaign  
→ Campaign Send  
→ Recipient Delivery  
→ Events

This allows Octo to know what happened to each recipient.

Possible delivery states include:

- queued
- sent
- delivered
- delayed
- failed
- bounced
- complained
- suppressed

Provider identifiers from Resend should be retained so webhook events can be reconciled with Octo records.

---

# Engagement Data

Engagement data is foundational.

Octo needs to know:

- whether delivery occurred
- recorded opens
- first recorded open
- last recorded open
- open count
- clicks
- first click
- last click
- click count
- which links were clicked
- bounces
- complaints
- unsubscribes

Do not store only:

`opened = true`

Preserve raw events.

Derived summaries may be maintained for performance, but the underlying event history should remain available.

---

# Open Tracking Caveat

Email open data is imperfect.

Privacy systems, image proxies, image blocking, and email-client behavior can create both false positives and missing opens.

Therefore the product should use terminology such as:

**Recorded Open**

rather than implying that Octo knows definitively whether someone read an email.

Clicks are generally a stronger behavioral signal and should be tracked independently.

---

# Behavioral Resends

Behavioral follow-up is a core requirement.

Octo should support creating new audiences from previous campaign behavior.

Examples:

**No recorded open**

Resend with a different subject or revised message.

**Opened but didn't click**

Send a different CTA or follow-up.

**Clicked specific link**

Send a relevant follow-up.

**Already completed desired action**

Exclude from follow-up.

A resend should normally be represented as a new campaign/send related to the original campaign rather than mutating or rerunning the historical campaign.

---

# Analytics

Campaign analytics should eventually include:

- audience size
- attempted
- sent
- delivered
- delivery rate
- bounced
- complaints
- recorded opens
- unique recorded opens
- clicks
- unique clicks
- click-through rate
- unsubscribes

Octo should also expose contact-level communication history.

Analytics should be derived from Octo's own delivery/event data rather than requiring Resend to remain the analytics system of record.

---

# Sending Infrastructure

Do not send thousands of emails synchronously from a browser request.

Sending architecture should account for:

- batching
- background processing
- retries
- rate limits
- failures
- idempotency
- scheduling

Use the simplest reliable architecture appropriate for Octo's scale.

Current scale is only several thousand contacts, so avoid unnecessary enterprise infrastructure.

However, do not build something that becomes fundamentally unsafe as volume grows.

---

# Webhooks

Resend webhooks should flow back into Octo/Supabase.

Webhook handling must account for:

- verification
- retries
- duplicate events
- events arriving out of order
- provider message IDs
- idempotency
- unknown deliveries
- failure logging

Raw provider events may be retained where useful, while normalized Octo events should power product functionality.

---

# Images and Assets

High-quality visual email design requires proper asset management.

Plan for:

- image upload
- permanent public URLs
- asset reuse
- alt text
- dimensions
- optimization
- email-safe formats
- optional cropping/transformation
- future asset library

Never depend on temporary or expiring image URLs in sent email.

Use Octo's existing asset/storage infrastructure when appropriate rather than creating unnecessary parallel systems.

---

# Preview and Testing

The system should ultimately provide:

- desktop preview
- mobile preview
- actual compiled HTML preview
- test email sending
- personalization preview
- link validation
- missing-variable warnings
- unsubscribe validation
- pre-send checks

Editor preview and actual compiled-email preview are not necessarily identical concepts.

The compiled result matters.

---

# Mailchimp Migration

Mailchimp is the system being replaced.

Migration should eventually preserve useful information including:

- contacts
- email addresses
- names
- subscription status
- unsubscribes
- suppression information
- tags
- groups
- custom fields
- source/signup information where available
- historical engagement where practical and useful

Do not copy Mailchimp's architecture simply because the source data is structured that way.

Map imported data into Octo's canonical model.

Preserving unsubscribe and suppression information is mandatory.

---

# Current Editor Direction

The current preferred direction is:

**Maily + Octo-owned document model + MJML**

Maily currently appears preferable because its editing experience is closer to the modern, direct composition experience desired for Octo.

However, Maily is **not an immutable architectural decision**.

GrapesJS + MJML remains a relevant alternative if greater visual/layout control is required.

Any agent recommending a change should evaluate:

- design capabilities
- React/Next compatibility
- extensibility
- custom blocks
- responsive controls
- MJML integration
- document portability
- maintenance
- licensing
- UX
- long-term lock-in

Do not switch editor architecture casually once implementation begins.

---

# Current Product Scale

The system is initially replacing Mailchimp for an audience of approximately **3,000–4,000 contacts**, with roughly **1–2 marketing emails per week**.

Design for reasonable growth but do not optimize prematurely for millions of recipients.

---

# Initial Product Goal

The first usable version should ultimately make it possible to:

1. select/build an audience,
2. create a professionally designed email,
3. preview it,
4. send a test,
5. send or schedule the campaign,
6. reliably enforce unsubscribe/suppression rules,
7. track delivery,
8. track recorded opens,
9. track clicks,
10. view campaign performance,
11. create follow-up audiences from campaign behavior.

The foundation should support this without requiring architectural redesign later.

---

# Agent Operating Rules

Before modifying the email system:

1. Read this document.
2. Inspect the relevant existing Octo architecture.
3. Check existing schema and migrations.
4. Reuse existing Octo primitives where appropriate.
5. Identify whether the proposed change affects canonical architecture.
6. Preserve separation between editor, document, renderer, delivery provider, and engagement data.
7. Do not introduce a third-party dependency as the canonical source of Octo data.
8. Do not compromise subscription/suppression enforcement.
9. Do not compromise historical campaign reproducibility.
10. Do not sacrifice email-client compatibility merely for visual-editor flexibility.

When making a significant architectural decision, update this document.

---

# Decision Log

Significant decisions only. Routine implementation details do not belong here.

M.1, M.2, and the Postgres cutover below are **accepted**. The remaining entries stay **proposed** until their phase is built.

## 2026-09-25 — Canonical person is a new `people` table

**Decision (accepted, M.1).** Marketing identity lives in `public.people`, keyed by normalized email. Sales `public.contacts` stay organization-scoped prospects. Bloom `agent_participants` and Song Garden device marks link to a person when an email exists. They are not the audience table.

**Reason.** `contacts.organization_id` is required. Those rows are B2B prospects for Gmail outreach. Choir subscribers are a different consent basis. Putting both in one table would mix the sales queue with the marketing list.

**Alternatives considered.** Nullable `organization_id` on `contacts`. Reusing the marketing JSON `MarketingPerson` blob as the long-term model.

**Implications.** Unsubscribe updates a subscription and a suppression. It does not delete the person or any sales contact. Automatic import of sales contacts into the marketing audience is out of scope.

## 2026-09-25 — Postgres replaces `marketing/v1.json`

**Decision (accepted with Phase 1).** Supabase Postgres is the system of record. The Storage JSON blob at `marketing/v1.json` is migrated once, then left as a read-only archive. The app does not write that blob.

**Reason.** The blob is a single read-modify-write document with caps (recipients sliced to 20,000, events to 5,000), an 8-second cache, and no row-level history. `supabase/marketing-tables-deferred.sql` already calls SQL “optional future” and ships `select 1`. That deferral cannot support per-recipient events, immutability, or send-time eligibility.

**Alternatives considered.** Keep the JSON store and add tables only for deliveries.

**Implications.** Schema changes stay hand-written idempotent SQL files in `/supabase`, applied in the Supabase SQL Editor. RLS enabled, no anon policies, access via `supabaseAdmin`.

## 2026-09-25 — Octo section document, MJML 4.18 compiler, custom editor

**Decision (accepted, M.2).** The canonical document is versioned Octo JSON (`schemaVersion: 1`) of editorial sections. The server compiles it with pinned `mjml@4.18.0`. The editor is a React section stack plus inspector that reads and writes that JSON. Stable Maily (`@maily-to/core` 0.3.7) is a UX reference, not a dependency. Maily v2 beta is out. GrapesJS + `grapesjs-mjml` is the fallback only if the section editor cannot express a required layout. Phase 1 stores the document and does not install Maily or MJML.

**Reason.** Stable Maily stores TipTap JSON and renders through React Email (`@maily-to/render` → `@react-email/render` + `juice`), not MJML. Maily v2 (`2.0.0-beta.6`) requires React 19 and TipTap 3; this app is Next.js 14.2.35, React 18.3, TipTap 2.27. GrapesJS edits MJML directly and behaves like a page builder. Either choice would make a third-party document the system of record.

**Alternatives considered.** Embed Maily 0.3.7 and adapt its JSON. Fork Maily. Adopt Maily v2 and upgrade React. Adopt GrapesJS as the editor now.

**Implications.** Do not add `@maily-to/*` in phase 1. Rich text inside a section may use the TipTap packages already in `package.json`. Production HTML is the MJML compile, shown in an iframe. The on-canvas editor is an approximation.

## 2026-09-25 — Operational state lives on campaign sends

**Decision (proposed).** `campaigns` are the marketing object (`draft | active | archived`). `campaign_sends` carry subject, audience snapshot, frozen document version, schedule, and the state machine `draft → ready → scheduled → sending → sent | partially_failed | failed | cancelled`.

**Reason.** A follow-up is a new campaign linked by `source_campaign_id` / `source_send_id`, with its own document. Rerunning a historical send would rewrite what was delivered.

**Alternatives considered.** One row per campaign that stores subject, HTML, and stats together (the current `MarketingEmail`).

**Implications.** v1 UI may show one primary send per campaign. The tables still allow later sends without a migration.

## 2026-09-25 — Queue in Postgres, drain with a time-boxed worker, send through Resend batch

**Decision (proposed).** A send inserts one `email_deliveries` row per eligible person, then a worker claims batches with `FOR UPDATE SKIP LOCKED` and calls Resend `POST /emails/batch` (max 100). A chained invocation finishes a few thousand recipients inside normal Vercel durations. One safety cron every 10 minutes resumes anything left `sending`. Octo does not create Resend Audiences, Contacts, or Topics.

**Reason.** The current `sendMarketingEmailNow` loop sends one Resend call per recipient inside the browser request and then writes the whole JSON blob. Resend’s default team limit is 10 requests/second; a batch counts as one request. Resend idempotency keys expire after 24 hours, so the delivery row is the real idempotency record. Sales digest already documents that Resend is reserved for marketing (`lib/sales/digest/transport.ts`); Gmail remains the sales 1:1 channel.

**Alternatives considered.** Resend Broadcasts. A new Trigger.dev or Inngest service. A per-minute Vercel cron as the only worker.

**Implications.** Provider code sits behind a small `EmailProvider` interface. Webhooks are verified with `resend.webhooks.verify` on the raw body and deduped on the Svix id.

## 2026-09-25 — Eligibility is subscription plus active suppression

**Decision (proposed).** A person is mailable only when the `marketing` / `email` subscription is `subscribed` and no active suppression exists for that normalized email. Hard bounces and complaints insert suppressions. Imports must not clear them. Re-subscribe lifts unsubscribe suppressions only. The worker checks eligibility again immediately before each batch.

**Reason.** The current in-memory `isSendable` check runs while the audience is being built, and the webhook handler treats every bounce as a hard bounce and increments stats even on duplicate events.

**Alternatives considered.** A single status enum on the person. Relying on Resend’s suppression list alone.

**Implications.** Unsubscribe is a signed token, not a raw email query parameter. List-Unsubscribe and one-click POST are per recipient.

## 2026-09-25 — Email design tokens are not the admin chrome tokens

**Decision (proposed).** Email tokens live in `email_design_systems` and are edited at `/admin/settings/email-design`. Admin chrome stays in `lib/design-system/tokens.ts` (localStorage). Campaign composition stays at `/admin/marketing`.

**Reason.** Chrome tokens are accent, shell background, and list metrics for the admin UI. Email tokens are width, type scale, and button styles compiled into MJML. Settings still owns the master controls, per `docs/octo-settings-contract.md`.

**Alternatives considered.** Reusing `--csc-accent` as the only email theme. Putting design controls only inside each campaign.

**Implications.** Default email accent may start as `#CFFF81`, matching the admin accent, as a separate stored value.

---

# Open Architectural Decisions

M.1 and M.2 are accepted. Still open:

- Confirm whether production `marketing/v1.json` holds audience data that must be migrated before cutover.
- Confirm the verified Resend from-domain and physical mailing address.
- Confirm Mailchimp export format (CSV versus API) and whether historical Mailchimp campaign stats are worth importing.

Do not silently change these during implementation.
