# Song Garden V2 — Architecture & Implementation Plan

Scope: redesign the **participant-facing** experience of Song Garden. No changes to
`lib/sales/**`, `app/admin/sales/**`, `app/api/sales/**`, `components/sales/**`,
`docs/sales-platform/**`, or `scripts/sales/**` (separate concurrent work).

## 1. What already exists (reused, not rebuilt)

The real "Song Garden" participant flow is **not** the audio-clip drag/drop canvas at
`components/songgarden/SonggardenCanvas.tsx` (that's a separate pre-show admin
composition tool). It's the full guided journey rendered by
`components/participant-journey/ParticipantJourney.tsx` on the public event page
(`app/e/[slug]/page.tsx` → `PublicEventContent` → `ParticipantJourney`). That
component already implements every backend concern the product brief assumes exists:

| Concern | Existing implementation | Reused as-is |
|---|---|---|
| Event management | `data/mockEvents.ts` `Event` type, `app/api/events/**`, Supabase `events` table | ✅ |
| Question/prompt management | `AgentBrief.askAboutItems` (AI interview questions) + `SongGardenConfig.steps` (admin-configurable sound-pad prompts, `lib/songgarden/config.ts`) | ✅ |
| Participant registration | `AgentParticipant` + session tokens (`data/agentInterview.ts`, `lib/participant-journey/interview-helpers.ts`) | ✅ |
| Contribution storage | `AgentConversationTurn` rows (text/voice/video answers) + `songgarden_clips` table (audio pad clips) | ✅ |
| Multiple input types | text, voice, video (interview turns), audio pads (Song Garden slots) | ✅ |
| Admin workflows | `app/admin/events/[eventId]/edit` (`EventForm.tsx`), `app/admin/songgarden/[eventId]` | ✅ |
| Low-level recording engine | `lib/songgarden/quick-record.ts`, `pad-countdown.ts`, `reference-tones.ts`, `prepare-audio.ts`, `garden-storage.ts` | ✅ (reused directly, no changes) |

The **only** new data added is a small, additive, nullable `world_config` JSON column
on `events` (see §5) — everything else rides on the existing schema and APIs.

### Existing phase model (kept)

`ParticipantJourney` already drives a linear phase machine:

```
landing → lyric (AI interview, N questions) → sound_transition → garden (N sound-pad slots) → final
```

Song Garden V2 keeps this exact phase machine and all its data calls
(`startAgentInterview`, `sendMessage`, `submitSonggardenClip`, `saveDoneSlot`, …).
What changes is **only** the presentation layer: instead of a scrolling
form-like page, every phase now renders as an overlay on top of a persistent,
animated "world," with a celebration between every submission.

## 2. New concepts

### World config

A lightweight, additive config describing the visual world for one event. Minimal
setup required — every field has a sensible default derived from the event's
existing fields (title, hero image, existing `--crowdsource-accent` lime).

```ts
// lib/song-garden-v2/world-config.ts
type WorldAnimationPreset = "particles" | "aurora" | "glow" | "none";

type WorldConfig = {
  title: string;                 // defaults to event.title
  heroArtworkUrl: string | null; // defaults to event.heroImage
  logoUrl: string | null;
  primaryColor: string;          // defaults to "#1a0f2d" (existing bg)
  accentColor: string;           // defaults to "#CFFF81" (existing accent)
  animationPreset: WorldAnimationPreset;
  ambientSoundtrackUrl: string | null;
  aiArtworkPrompt: string | null; // reserved, unused this pass (AI artwork explicitly out of scope)
};
```

`resolveWorldConfig(event)` merges `event.worldConfig` (partial, from DB) over the
derived defaults, so **an event with zero world config still renders a fully
themed world** — configuring a new event is optional polish, not a requirement.

### Interaction engine

Reusable, presentation-only components in `components/song-garden-v2/`:

- `WorldStage` — full-viewport persistent background (gradient wash + animation
  preset + hero artwork + optional ambient soundtrack `<audio>`). Never unmounts
  between phases — this is what makes the world feel continuous instead of page
  transitions.
- `MomentOverlay` — the glass-panel overlay card that hosts Welcome / Creative
  Moment / Completion content. Cross-fades/slides with Framer Motion
  `AnimatePresence`; the `WorldStage` underneath never remounts.
- `WorldProgressTrail` — Duolingo-style dot trail (replaces the old thin progress
  bar) showing overall journey position.
- `ContributionTextField` — single-obvious-action text moment (adapts the
  existing text/email/captcha logic from `ParticipantJourney`).
- `ContributionRecorder` — presentational wrapper reusing `RecordAudio` /
  `RecordVideo` for interview voice/video answers.
- `SoundMomentPad` — new presentation for a single Song-Garden audio slot
  (stomp/clap/choir/etc). Reuses `quick-record.ts`, `pad-countdown.ts`,
  `reference-tones.ts`, `prepare-audio.ts`, `garden-storage.ts`,
  `submitSonggardenClip` directly — only the UI is new.
- `CelebrationBurst` — the ~1s Framer Motion celebration (glow pulse + particle
  burst + accent flash on `WorldStage`) fired after every accepted contribution,
  before the next moment appears. No badges/points/XP — purely motion/light.

### Celebration engine (the "emotional core")

Every contribution goes through the same loop, regardless of input type:

```
Submit → (API call succeeds) → CelebrationBurst plays (~900ms)
  → WorldStage reacts (accent pulse + one extra particle layer "unlocked")
  → MomentOverlay cross-fades to the next Creative Moment
```

This lives in one hook, `useCelebration()`, in
`components/song-garden-v2/engine/useCelebration.ts`, so every input type
(text, voice, video, sound pad) triggers the exact same celebration — one
implementation, not one per input type.

## 3. Mapping onto existing prompts / input types

| Journey phase | Creative-moment label | Input type | Backing call |
|---|---|---|---|
| name question (if enabled) | "Your Name" | text | `sendMessage` |
| lyric / interview questions | "Your Words" | text, optional voice/video | `sendMessage` |
| sound_transition | (auto, no input) | — | local phase advance |
| garden: beat slots | "Your Rhythm" | tap-to-record pad | `submitSonggardenClip` |
| garden: choir slots | "Your Voice" | tap-to-record pad w/ reference tone | `submitSonggardenClip` |
| garden: one_word slot | "Your Word" | tap-to-record pad | `submitSonggardenClip` |
| garden: anything_else slot | "Your World" | tap-to-record pad | `submitSonggardenClip` |
| final | "You're part of it" | — (completion) | — |

The label mapping lives in `lib/song-garden-v2/moment-labels.ts` and is derived
from the *existing* `phaseLabel`/slot-type data already produced by
`lib/songgarden/config.ts` — no admin changes are required to get moment labels;
they're computed, not authored (event owners can still override `phaseLabel`/
`prompt` per step in the existing admin UI and it flows through unchanged).

## 4. What's replaced vs. reused

**Reused untouched:** every data client (`data/agentInterview.ts`,
`data/songgardenClient.ts`, `data/eventsClient.ts`), every API route, every
Supabase table, all low-level recording/audio utilities in `lib/songgarden/`,
`lib/participant-journey/interview-helpers.ts`, `lib/agent-name-question.ts`,
`lib/participant-journey/contribution-consent.ts`, `lib/participant-journey/example-words.ts`,
the admin event editor and Song Garden admin canvas.

**Replaced (participant-facing presentation only):** the JSX/markup in
`ParticipantJourney.tsx` and `SoundGardenExperience.tsx` is not edited — instead a
parallel presentation-only orchestrator, `WorldJourney.tsx`, is added under
`components/song-garden-v2/`, reusing the same phase state machine shape and the
same backend calls, mounted from a new route (`app/e/[slug]/world/page.tsx`) so the
existing production participant route (`/e/[slug]`) is completely untouched and
low-risk. `docs/song-garden-v2/architecture.md` (this file) plus the code comments
call out that a full cutover (making `/e/[slug]` render the V2 experience directly,
and retiring the old journey UI) is a deliberate follow-up decision, not done in
this pass, so existing/live events are never put at risk mid-session.

## 5. Schema change (additive, manual one-time migration)

`supabase/songgarden-v2-world-config.sql` adds one nullable JSON column:

```sql
alter table public.events
  add column if not exists world_config jsonb default null;
```

Follows the exact house style of `supabase/prod-patch-events-columns.sql` /
`supabase/sales-platform-add-*.sql`: additive, `if not exists`, safe to re-run,
no destructive change. **Must be run once in the Supabase SQL Editor** before
`worldConfig` overrides can be saved from the admin form — the experience still
renders (with derived defaults) without it, since the API layer degrades
gracefully if the column is missing is *not* guaranteed by Supabase (a `select *`
will simply omit the field), so this migration should be run before relying on
custom world config in production.

## 6. MVP priority coverage this pass

1. **Interaction engine** — done (`components/song-garden-v2/engine/*`).
2. **World layer** — done (`WorldStage`, animation presets, per-event config).
3. **No traditional page transitions** — done; `WorldJourney` never navigates
   between routes for phase changes, only `AnimatePresence` cross-fades inside
   `MomentOverlay` while `WorldStage` persists.
4. **Celebration animations** — done for the core submit moment (`CelebrationBurst`
   + `useCelebration`), fired identically for text/voice/video/audio-pad
   contributions.
5. **Broader motion/polish refinement** — intentionally minimal; only the
   celebration + a few ambient world animations were polished. Larger motion
   language (page-level easing curves, sound design pass, richer particle art)
   is future work.

## 7. Next steps / explicitly not done this pass

- Full cutover of `/e/[slug]` to V2 (currently a separate `/e/[slug]/world` route).
- Admin UI is a minimal flat form (title/hero/colors/preset/soundtrack URL) —
  no live world preview inside the admin editor yet.
- Ambient soundtrack is a plain looping `<audio>` tag with an unlock-on-first-tap
  gesture; no crossfade/ducking between tracks.
- No automated tests were added; verification was manual (see session report).

## 8. Living world layer (added after initial pass)

The initial pass above nailed the interaction engine and celebration loop, but the
world itself didn't visibly change — the background reset to the same look after
every celebration and there was no signal that anyone else was contributing. This
addition closes that gap along three axes, all additive/backward-compatible:

### 8a. Persistent growth (the participant visibly shapes the world)

`lib/song-garden-v2/growth-nodes.ts` + `components/song-garden-v2/WorldGrowthLayer.tsx`.
Every accepted contribution (text/voice/video answer, or sound-pad submission)
appends a `WorldGrowthNode` (persisted to `localStorage` per event, so it survives
reloads) instead of only firing the transient `CelebrationBurst`. Nodes are laid out
with a phyllotaxis (sunflower-seed) spiral — `growthNodePosition()` — so the garden
reads as organic growth rather than random scatter, and never unmount: the burst
becomes the node's entrance animation, then it idles forever after. `WorldJourney`
calls `appendGrowthNode()` right before `celebration.celebrate()` on every submit
path (`handleChatSubmit`, `handleSlotSubmitted`), tagging the node's kind
(`text`/`voice`/`video`/`percussion`/`vocal`/`other`) so different contribution
types visually differ.

### 8b. Growth-stage world art (the place itself evolves)

`WorldConfig.worldSceneStages` (`lib/song-garden-v2/world-config.ts`) is an ordered
list of `{ threshold, sceneUrl }` — e.g. a dormant scene at 0% and a full-bloom scene
at 40%+. `resolveWorldSceneUrl(world, energyLevel)` picks the highest-threshold
scene reached; `WorldStage` crossfades between them via Framer Motion
`AnimatePresence` keyed on the URL. Falls back to the existing single
`heroArtworkUrl` with no crossfade if no stages are configured — fully
backward-compatible with events configured under §1–§6. Configurable per event in
`EventForm.tsx` ("World growth stages"). `public/song-garden-v2/world-scenes/`
holds a first prototype pair (dormant/bloom) generated for an ETHGlobal-style test
event, used to validate the mechanic end-to-end.

### 8c. Ambient collective presence (others are visibly here too)

`app/api/events/[id]/activity/route.ts` is a read-only, aggregate-only endpoint
(participant/clip counts, total + last-10-minutes, never individual content) reused
from the existing `agent_participants` / `songgarden_clips` tables (and their local
JSON-store equivalents). `lib/song-garden-v2/presence.ts` polls it and blends real
counts into rotating ambient lines; `WorldPresenceTicker.tsx` renders them as a
quiet pill near the top of the world. Real signal is always preferred; generic
(non-fabricated) simulated lines only fill in when recent real activity is near
zero, and only when `WorldConfig.presenceSimulationEnabled` (default on, toggle in
`EventForm.tsx`) allows it — so a solo tester never sees an empty room, but a live
event with real traffic never gets fed made-up specifics.

### Known simplification

The activity endpoint counts the current participant's own "join" as recent
participant activity (it has no way to exclude "self" server-side without a
session-aware query), so a solo tester may briefly see "a new voice just joined"
referring to themselves. Harmless for the ambient-vibe use case, but worth
tightening (exclude own session token) before relying on it for precise per-person
messaging.

### 8d. Follow-up polish: full-viewport spread, locked layout, literal growth

First-round testing surfaced three concrete issues, all fixed additively:

- **Growth nodes clustered below the card.** `growthNodePosition()` originally
  fanned out from a point near the *bottom* of the world (yPct anchored at 78,
  vertically compressed). Changed the spiral origin to the screen's true center
  (50/50, with a 1.35x vertical stretch tuned for portrait phones) so nodes fill
  the entire garden — above, beside, and below the card — instead of piling up in
  one corner.
- **Layout could drift off-center depending on content height / mobile browser
  chrome.** `WorldStage`'s root was `min-h-[100dvh]`, which let the page grow
  taller than one screen (and therefore scroll) whenever a moment's content was
  tall. Changed to a hard `h-[100dvh] overflow-hidden` shell with an inner
  `h-full overflow-y-auto` content column (`MomentOverlay`'s flex-1 wrapper now
  has `min-h-0` so it actually shrinks/scrolls instead of forcing the parent
  taller). Net effect: the interaction card centers reliably in whatever space is
  left below the header, on any screen size, without page-level scroll ever
  fighting the absolutely-positioned ambient layers (background, vines, orbs,
  presence ticker) that are pinned to the same locked viewport.
- **"I want to see the plants grow, not just become visible."** A first attempt
  (hand-authored SVG vine paths animated via `pathLength`) was tried and reverted
  — it read as thin lines drawing themselves for a couple of seconds and stopping,
  not as a living plant. Superseded by §9 below.

## 9. Storyboard + embodiment layer (second follow-up)

Further feedback (real feedback quotes: "remove the vines... they look like lines
that move for a couple seconds then stop"; "I don't want a mascot, I want more of
a responsive environment... I want the image to actually evolve"; "what if we have
a combo of all of them... I'm going to shorten the experience... 5 [moments] per
event... prescriptive... think about the regenerative foundation... the closest
thing to embodiment with a screen interaction") drove a deliberate architecture
shift: away from a continuously-blended energy curve and hand-drawn SVG motion,
toward a small, fixed, deterministic **storyboard** plus two always-on reactive
layers that need no AI dependency to feel alive today.

### 9a. Discrete storyboard (`WorldConfig.worldStoryboard`)

`lib/song-garden-v2/world-config.ts` adds `WorldStoryboardFrame[]` — an ordered,
fixed-length sequence of world states (e.g. 6 frames: dormant → awakening → ... →
full bloom), each with an optional `videoUrl` (a short seamless loop — priority)
and/or `sceneUrl` (still fallback/poster). `resolveStoryboardFrame()` **snaps**
journey progress (`energyLevel`, already 0..1 = completed/total steps) to exactly
one frame — `Math.floor(energyLevel * frames.length)` — no blending. This
replaces continuous crossfading with something intentionally choreographed: the
same progress always lands on the same frame, for every participant, every
replay ("prescriptive" per the brief). It's designed around short (~5-moment)
journeys, where a handful of authored states can cover the whole arc. The legacy
`worldSceneStages` continuous blend is kept as a fallback for events with no
storyboard configured — nothing existing breaks. `WorldStage` renders
`worldStoryboard` frames first, then falls back to the old blend, then to
`heroArtworkUrl`.

Video generation itself (turning an admin-uploaded venue/city/org photo into
each frame's loop) needs an external image-to-video provider (Runway/Luma/
Stability/etc.) and an API key that wasn't available this pass — `EventForm.tsx`
has a manual URL-entry admin UI for the storyboard today (paste a video/image URL
per frame), ready to be auto-filled by a generation pipeline once a provider is
chosen.

### 9b. 2.5D embodiment layer (`lib/song-garden-v2/tilt.ts`)

`useAmbientTilt()` gives the background real depth-of-field motion with zero API
dependency: it prefers live device tilt (`deviceorientation`, permission
requested via `requestTiltPermission()` at the same tap that starts the journey
— required on iOS 13+), falls back to mouse position on desktop, and always has
a slow autonomous drift underneath so the world is never perfectly still even
with the phone flat on a table. `WorldStage` applies the resulting `x`/`y` as a
transform on an oversized (`-inset-[5%]`) wrapper around the background layer so
the drift never reveals an edge.

### 9c. Reactive energy field (`WorldEnergyField.tsx`)

Replaces the old one-off "flash to nothing" celebration overlay in `WorldStage`
with a persistent glow whose *resting* brightness (`baseIntensity`, driven by the
current storyboard frame's `energy`, or `energyLevel` as a fallback) rises across
the storyboard, plus an instant pulse on every single contribution that spikes
brighter and eases back down to the *current* resting level — not to zero. This
is the literal "click → glows brighter → resets" behavior, and it's the one
layer that's live-reactive moment-to-moment rather than only advancing at
storyboard checkpoints. `ParticleField`'s ambient dust density is driven by the
same `baseIntensity` signal for consistency.

### 9d. Haptics (`lib/song-garden-v2/haptics.ts`)

`pulseHaptic()` fires a short `navigator.vibrate()` buzz alongside every
`growNode()` call (text/voice/video answers and sound-pad submissions) — paired
with the energy-field pulse, this is the closest a screen interaction gets to a
felt, physical response. Silently no-ops on unsupported devices/browsers.

### 9e. Shortened journey

The real test event (`csc-aug21`) was reconfigured from an open-ended ~6-question
flow + 4 sound-garden slots down to 3 scripted `agentBrief.askAboutItems`
questions + 1 enabled `songGardenConfig` step (5 real content-collecting moments
total, plus the fixed transition/final beats) — validating the "fewer moments,
more impact" pacing end-to-end against the new storyboard/energy-field stack.

## 10. AI storyboard generator (Runway)

Closes the loop on 9a: instead of pasting `worldStoryboard` frame URLs by hand,
the admin can upload one photo of the venue/city/org, describe the vibe, and get
back a full sequence of looping videos that animate that same place from
dormant to full bloom — making it practical to stand up a bespoke world per
event without any manual video editing.

- **`lib/song-garden-v2/runway.ts`** — minimal client for Runway's API
  (`https://api.dev.runwayml.com`, `Authorization: Bearer`, header
  `X-Runway-Version: 2024-11-06`). `generateVideoFromImage()` submits a
  `POST /v1/image_to_video` job (model `gen4_turbo`) and polls
  `GET /v1/tasks/{id}` until it succeeds or fails, classifying errors into
  `RunwayError` codes (`not_configured`, `invalid_key`, `insufficient_credits`,
  `rate_limited`, `api_error`) so the UI can show a specific, actionable
  message. `getRunwayAccountStatus()` hits `GET /v1/organization`, which is
  free (does not spend credits) — this backs the admin's "Check Runway
  credits" button so nothing has to actually generate to know whether the
  account is funded yet.
- **`app/api/admin/runway-status/route.ts`** — thin `GET` wrapper around the
  account check above.
- **`app/api/events/[id]/generate-storyboard/route.ts`** — `POST { imageDataUrl,
  vibePrompt, frameCount }`. Builds one prompt per frame by combining the
  admin's vibe description with a fixed ladder of escalating "aliveness"
  modifiers (`INTENSITY_MODIFIERS`, quiet/dormant → radiant/full-bloom), so the
  *same* base photo is animated at increasing intensity across the sequence —
  no need to source or generate multiple base images per event. Runs frames
  sequentially and stops on the first failure, returning whatever frames
  already succeeded (`framesCompleted`/`framesRequested`) plus a specific
  error — critical for the `insufficient_credits` case (HTTP 402) so a
  mid-storyboard funding top-up doesn't throw away completed frames.
- **`lib/song-garden-v2/persist-generated-media.ts`** — Runway's task output
  URLs expire in 24-48h, so every generated video is downloaded and re-hosted
  before being written into `worldConfig.worldStoryboard`: uploaded to a
  public Supabase Storage bucket (`SONG_GARDEN_MEDIA_BUCKET`, auto-created)
  when Supabase is configured, or written straight into
  `public/song-garden-v2/world-scenes/generated/` for local dev without
  Supabase set up.
- **`components/EventForm.tsx`** — "Generate with AI (Runway)" panel above the
  manual storyboard frame list: photo upload, frame count (2-8), vibe
  textarea, a "Check Runway credits" button, and "Generate storyboard with
  AI". Successful/partial results populate the same `worldStoryboard` form
  state as manual entry — nothing is written to the event until the admin
  hits the form's own Save.
