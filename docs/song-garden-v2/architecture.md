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
- AI artwork generation (explicitly out of scope per brief).
- Ambient soundtrack is a plain looping `<audio>` tag with an unlock-on-first-tap
  gesture; no crossfade/ducking between tracks.
- No automated tests were added; verification was manual (see session report).
