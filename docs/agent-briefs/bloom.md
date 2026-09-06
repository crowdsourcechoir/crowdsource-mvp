# BLOOM Agent — live events and activations

| | |
|---|---|
| **Admin home** | `/admin/events` |
| **Public surface** | `/e/[slug]` |
| **Code prefixes** | `app/admin/events`, `app/e/[slug]`, `app/api/events`, `app/api/agent`, `lib/events-db.ts`, `components/EventForm.tsx`, `components/song-garden-v2/WorldJourney.tsx` |
| **Primary tables** | `events`, `agent_participants`, `agent_conversations`, `agent_conversation_turns`, `agent_themes` |
| **Reference docs** | `docs/song-garden-v2/architecture.md`, `docs/conference-7day-readiness.md` |

## 1. Mission

A Bloom is the moment a Garden becomes visible, musical, social, and alive — an event,
gameday, conference, or activation. This agent owns the Bloom lifecycle: creating and
configuring one in the admin, and the entire participant experience at `/e/[slug]` from
landing through the last journey step.

**In code a Bloom is an `events` row.** The product language changed; the schema and URLs did
not, deliberately, for stability.

## 2. Scope

### Owns

- Bloom admin: `app/admin/events/**`
- The event model and its accessors: `lib/events-db.ts`, `supabase/events-table.sql`
- The configuration form: `components/EventForm.tsx`, `lib/event-form-draft.ts`
- Public participant experience: `app/e/[slug]/**`, `components/song-garden-v2/WorldJourney.tsx`
- Journey step resolution: `lib/songgarden/journey-steps.ts`, `lib/participant-journey/**`
- The interview conversation APIs: `app/api/agent/**`
- Runway world storyboard generation and recovery

### Does not own

| Belongs to | When it comes up |
|---|---|
| GARDEN | Garden persistence, chapters, `/g/[slug]`, the clip library itself |
| ROOTS | *Why* a journey is shaped the way it is — question design, risk laddering |
| COMPOSER | Song seeds and composition briefs generated from Bloom contributions |
| LIVE | Anything the operator drives during the event |
| OCTO | Admin chrome, tokens, auth |

BLOOM builds the journey machinery. ROOTS decides what a good journey is.

## 3. Start a new BLOOM agent

```text
You are the BLOOM agent for Crowdsource Choir. You own live events and activations: the
Bloom admin at /admin/events, the event model, EventForm, and the public participant
experience at /e/[slug] (WorldJourney).

Read these first:
- docs/agent-briefs/bloom.md — your brief, including open threads
- docs/song-garden-v2/architecture.md — the V2 participant architecture you maintain
- docs/octo-living-system-workspace.md — living-system vocabulary

Critical: "Bloom" in product language is the `events` table in code. Do not rename it.
The public route runs WorldJourney (V2); ParticipantJourney (V1) is legacy and unmounted.
Garden persistence belongs to GARDEN; you connect through garden_chapters.

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### Routes

| URL | File | Purpose |
|---|---|---|
| `/admin/events` | `app/admin/events/page.tsx` | Bloom list, storyboard orphan recovery, public-link copy |
| `/admin/events/new` | `app/admin/events/new/page.tsx` | Garden-first create; `?standalone=1` for the rare no-garden Bloom |
| `/admin/events/[eventId]` | `app/admin/events/[eventId]/page.tsx` | Manage: preview, song seed, memory archive, submissions, wipe |
| `/admin/events/[eventId]/edit` | `app/admin/events/[eventId]/edit/page.tsx` | `EventForm`; restores a local draft when the server journey is empty |
| `/e/[slug]` | `app/e/[slug]/page.tsx` → `EventPageClient.tsx` | Public Bloom, SSR with `revalidate=60`, renders `WorldJourney` |
| `/e/[slug]/interview` | `app/e/[slug]/interview/page.tsx` | Legacy standalone chat UI |
| `/e/[slug]/opengraph-image` | `app/e/[slug]/opengraph-image/route.ts` | OG image from the hero |

`/e/[slug]/world` and `/e/[slug]/songgarden` both redirect to `/e/[slug]`.
`app/e/[slug]/PublicEventContent.tsx` is the V1 shell and is no longer mounted.

### API

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/events` | GET, POST | List, or detail by `?slug=`; create |
| `/api/events/[id]` | GET, PATCH, DELETE | Detail, update, delete and unlink chapters |
| `/api/events/[id]/activity` | GET | Presence counts for the ambient ticker |
| `/api/events/[id]/garden-snapshot` | GET | Shared snapshot when chapter-linked |
| `/api/events/[id]/submissions` | DELETE | Wipe interviews, clips, seeds, memory for testing |
| `/api/events/[id]/generate-storyboard` | POST | Runway generation, `maxDuration=300` |
| `/api/events/[id]/storyboard-versions` | GET | Every stored still and loop including superseded |
| `/api/events/storyboard-orphans` | GET, POST | Find and reattach storyboards with no event |
| `/api/events/hero-upload/prepare` | POST | Signed hero upload, bypasses body size limits |
| `/api/agent/participants` | POST | Start or resume a participant and conversation |
| `/api/agent/conversations/[conversationId]/send` | POST | Submit a turn; managed-journey stub or LLM; applies garden mutation |
| `/api/agent/conversations/[conversationId]/media/prepare` | POST | Signed upload for journey audio and video |
| `/api/agent/interview-submissions` | GET | Paired question and answer list for admin |
| `/api/agent/themes` | GET | Interview themes |

### Libraries and components

| File | Purpose |
|---|---|
| `lib/events-db.ts` | Row mapping, list versus detail selects, hero and storyboard recovery |
| `components/EventForm.tsx` | The configuration surface, roughly 2700 lines |
| `lib/event-form-draft.ts` | `localStorage` draft under `csc_event_form_draft_v1` |
| `lib/songgarden/journey-steps.ts` | Resolves `journeySteps`; syncs legacy `agentBrief.askAboutItems` |
| `lib/agent-journey-managed.ts` | Detects a managed journey so `/send` skips OpenAI |
| `lib/agent-llm.ts` | Interview engine for the non-managed path |
| `lib/participant-journey/interview-helpers.ts` | Session tokens and the interview version hash |
| `lib/participant-journey/contribution-consent.ts` | Consent copy and the require flag |
| `components/song-garden-v2/WorldJourney.tsx` | The participant orchestrator |
| `components/song-garden-v2/WorldStage.tsx` | Persistent world background |
| `components/song-garden-v2/TextMomentPad.tsx` | Text contribution moment |
| `components/song-garden-v2/SoundMomentPad.tsx` | Audio moment, writes songgarden clips |
| `components/song-garden-v2/VideoMomentPad.tsx` | Video moment |
| `lib/event-slug-aliases.ts` | Slug aliases, currently `thresholds` → `csc-oct8` |

### The event model

`public.events` columns that carry real behavior:

| Column | Controls |
|---|---|
| `slug` | The public URL `/e/{slug}` |
| `title`, `description`, `date`, `time`, `venue`, `address` | Display and metadata |
| `hero_image`, `hero_image_mode` | Hero for list thumbs and OG; `bw` or `color` is a V1 treatment |
| `landing_headline`, `landing_copy`, `cta_text` | Landing copy |
| `anthem_completion_message` | Final screen |
| `song_garden_config` | JSON. **Holds `journeySteps`** plus eyebrows, buttons, legacy pads |
| `agent_theme_id` | Interview tone template, FK to `agent_themes` |
| `agent_brief` | JSON event brief: consent flags and text, ask-about items, event type |
| `world_config` | JSON V2 world: colors, logo, storyboard frames, ambient, presence |

Defined in `supabase/events-table.sql`, extended by `supabase/prod-patch-events-columns.sql`,
`supabase/agent-interview-tables.sql`, and `supabase/songgarden-v2-world-config.sql`.
`supabase/prod-patch-events-list-timeout.sql` clears data-URI heroes and adds a date index.

### EventForm sections

One long form, not tabs:

1. **Basics** — title, public URL, description, date and time, venue with map, hero upload
2. **Event details** — welcome eyebrow, landing headline and copy, CTA, completion eyebrow,
   message and button, contribution consent, hero photo mode
3. **World** — world title, client logo, hero artwork, colors, animation preset, ambient
   soundtrack, storyboard generation with place refs and version history, presence simulation
4. **Journey** — template seeds, then the ordered step list: eyebrow, channels, storyboard
   frame tie, record length, skip

On save, `syncLegacyFromJourneySteps()` writes the journey into
`song_garden_config.journeySteps` and mirrors it into legacy `agentBrief.askAboutItems`.

### Participant flow

```text
landing → step[0..n]  (name | text | sound | video) → final
```

Landing shows the welcome eyebrow, typewriter headline, and optional consent checkbox; the
CTA unlocks audio and tilt and enters step 0. Steps come from `resolveJourneySteps(event)`.
Each step can pin a `storyboardFrameIndex`. Progress persists in `localStorage` and is
invalidated by the interview version hash when the brief or journey changes.

### Verification

```bash
npx tsx scripts/test-journey-sound-duration.mjs
npx tsx scripts/test-journey-storyboard-tie.mjs
npx tsx scripts/test-storyboard-multi-refs.mjs
npx tsx scripts/test-storyboard-recovery.mjs
node scripts/test-event-hero-thumbs.mjs
npx tsx scripts/test-welcome-eyebrow.mjs
node scripts/test-no-auto-name-gate.mjs
npx tsx scripts/test-interview-qa-pairing.mjs
node scripts/test-prompt-typewriter-wiring.mjs
node scripts/smoke-event-form-draft.cjs
```

`scripts/test-journey-first-turn.mjs` needs a running server and `USE_LOCAL_EVENTS=true`.
`scripts/mobile-songgarden-check.mjs` is a Playwright mobile layout check.

Known slugs: `csc-aug21` is the shortened-journey test Bloom from the architecture doc;
`csc-apr1` is the mobile script default; `ballard-fc` is the seeded demo garden.

## 5. State of play

### Working

- Bloom CRUD, garden-first create, chapter attach
- `/e/[slug]` running WorldJourney with world stage, celebrations, and haptics
- Runway storyboard generation, storage recovery, orphan reattach, version history
- Agent interviews with managed journeys, clip capture, song seed, memory archive
- Zone-to-Bloom handoff from a garden map
- List timeout mitigations: no data-URI heroes in the list select

### Partial or prototype

- Storyboard generation is one synchronous request with `maxDuration=300`. It should be a
  background job
- V1 `ParticipantJourney`, `PublicEventContent.tsx`, and `/e/[slug]/interview` are still in
  the tree but off the public path
- Parts of `docs/song-garden-v2/architecture.md` still describe V1 as the public path; §7 is
  the correct account of the cutover

### Not built

- Admin live preview of the participant world
- Any participant identity beyond an anonymous device id and optional display name

## 6. Rules and gotchas

1. **Bloom is `events`.** UI language and schema differ on purpose. Do not rename tables or
   routes to match the vocabulary.
2. **V2 is the public path.** `/e/[slug]` mounts `WorldJourney`. Fixing participant UX by
   editing `ParticipantJourney` changes nothing a visitor sees.
3. **`journeySteps` lives inside JSON,** in `song_garden_config`, not its own column.
   `rowToEvent` surfaces it. Always write through `syncLegacyFromJourneySteps()` so V1
   consumers and the send route stay consistent.
4. **A managed journey skips OpenAI.** When steps resolve, `/send` returns a stub with
   `stopReason: "journey_managed"`. Do not expect per-turn LLM behavior on normal Blooms.
5. **Name collection is opt-in.** There is no automatic name gate; a name step must be in the
   journey. `scripts/test-no-auto-name-gate.mjs` guards this.
6. **Never add `hero_image` or the big JSON columns to the list select.** That caused
   production timeouts. Use `EVENT_LIST_SELECT` and `attachHostedHeroes`.
7. **Storyboard files outlive database rows.** Orphans are recoverable by filename convention;
   generation appends rather than replacing, and versions keep history.
8. **The garden link is a chapter,** created by `POST /api/gardens/[id]/chapters` after the
   event exists. There is no `events.garden_id`.
9. **The form draft is browser-only.** `csc_event_form_draft_v1` is not persistence; a Save is.
10. **The interview version hash invalidates participant progress** when the brief or journey
    changes. Editing a live Bloom's journey resets people mid-flow.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Storyboard generation as a background job | A 300 second synchronous request is fragile | `app/api/events/[id]/generate-storyboard/route.ts` |
| Delete V1 journey code | Two participant implementations is a standing source of confusion | `app/e/[slug]/PublicEventContent.tsx`, `components/participant-journey/ParticipantJourney.tsx` |
| Admin preview of the participant world | Configuring a world blind requires opening the public URL | `components/EventForm.tsx` World section |
| Correct the V1 framing in the architecture doc | The intro contradicts §7 | `docs/song-garden-v2/architecture.md` |
| Warn before editing a live Bloom's journey | Version hash silently resets participants | `lib/participant-journey/interview-helpers.ts` |

## 8. Handoff log

### 2026-09-06 — brief created

- Changed: nothing in the domain; this brief was written from a code survey.
- Learned: the V1/V2 split is the single most confusing thing here — V1 files are present,
  compile, and are unreachable from the public route.
- Watch out: editing a live journey invalidates in-progress participant sessions.
