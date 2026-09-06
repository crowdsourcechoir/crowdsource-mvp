# LIVE Agent — runtime tools for active Blooms

| | |
|---|---|
| **Admin home** | `/admin/live` |
| **Public surface** | `/live/[slug]`, `/resonance` |
| **Code prefixes** | `app/admin/live`, `app/admin/live-prompt-game`, `app/admin/resonance`, `app/live`, `app/resonance`, `app/api/live-prompt-game`, `app/api/resonance` |
| **Primary tables** | `prompt_game_sessions`, `prompt_game_rounds`, `prompt_game_submissions`, `prompt_game_votes`, `prompt_game_ai_outputs` |
| **Reference docs** | `Protocols/resonance-native-haptics-bridge.md`, `Protocols/tech-mapping-spec.md` |

## 1. Mission

Live is the control surface for what is happening right now in the room: prompt sessions the
host drives, phones in the audience's hands, collective voting, and signal experiments. It is
the runtime layer, not the event business — a Bloom is the event, Live is what the operator
holds during it.

## 2. Scope

### Owns

- Live home and mode selection: `app/admin/live/page.tsx`
- The prompt game end to end: host control room, audience join, voting, moderation, export
- Signal: collective harmonic voting and the Ableton trigger contract
- Resonance: the color field and hold-to-resonate surface
- The conductor operator UI at `app/admin/conductor/**` (ROOTS owns the model behind it)
- Anything that has to respond within the length of a song

### Does not own

| Belongs to | When it comes up |
|---|---|
| BLOOM | The event record, pre-show participant journey, `/e/[slug]` |
| ROOTS | Which participation modes are allowed and why; the show arc model |
| COMPOSER | What gets made from what the room produced |
| GARDEN | Persisting the night into a world |
| OCTO | Chrome and Settings |

## 3. Start a new LIVE agent

```text
You are the LIVE agent for Crowdsource Choir. You own runtime tools for active Blooms: the
prompt game (host control room, audience phones, voting, moderation), Signal harmonic
voting, the Resonance field, and the conductor operator UI.

Read these first:
- docs/agent-briefs/live.md — your brief, including open threads
- Protocols/resonance-native-haptics-bridge.md — the native haptics contract
- docs/octo-living-system-workspace.md — living-system vocabulary

There is no realtime transport in this app. Everything polls. Design demos around that.
The show arc and participation taxonomy are ROOTS'; the event record is BLOOM's.

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### Routes

| URL | File | Purpose |
|---|---|---|
| `/admin/live` | `app/admin/live/page.tsx` | Pick a mode (Game, Fishbowl, Signal), optionally link a Bloom, launch a session |
| `/admin/live-prompt-game/sessions` | `app/admin/live-prompt-game/sessions/page.tsx` | Past sessions |
| `/admin/live-prompt-game/sessions/[id]` | `app/admin/live-prompt-game/sessions/[id]/page.tsx` | **Host control room**: stage state, QR, send prompts, category queue, Signal, moderate cards, voting, CSV export, Song Pack |
| `/admin/conductor/[eventId]` | `app/admin/conductor/[eventId]/ConductorPageClient.tsx` | Per-Bloom facilitator view over the show arc |
| `/admin/resonance` | `app/admin/resonance/page.tsx` | Conductor field picker: Violet, Teal, Yellow, Blue |
| `/live/[slug]` | `app/live/[slug]/page.tsx` | Audience phone: wait, respond, vote |
| `/live/[slug]/display` | `app/live/[slug]/display/page.tsx` | Full-screen QR only — not a results board |
| `/resonance` | `app/resonance/page.tsx` | Audience color field with hold-to-resonate |

### API

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/live-prompt-game/sessions` | GET, POST | List, resolve by `?slug=`, create |
| `/api/live-prompt-game/sessions/[id]` | GET, PATCH | Fetch; update `state`, `current_round_id`, `ended_at` |
| `/api/live-prompt-game/sessions/[id]/rounds` | GET, POST | List; create a round and move the session to `RESPONDING`, or `VOTING` for Signal |
| `/api/live-prompt-game/sessions/[id]/rounds/[roundId]` | PATCH | Close a round |
| `/api/live-prompt-game/sessions/[id]/submissions` | GET, POST | List; audience submit |
| `/api/live-prompt-game/sessions/[id]/submissions/[submissionId]` | PATCH | Moderate: hide or lock |
| `/api/live-prompt-game/sessions/[id]/votes` | GET, POST | My votes; cast a vote |
| `/api/live-prompt-game/sessions/[id]/phrase-cards` | GET | Deduped, spam-filtered cards with vote counts, top 12 |
| `/api/live-prompt-game/sessions/[id]/ai-process` | POST | Generate a Song Pack into `prompt_game_ai_outputs` |
| `/api/live-prompt-game/sessions/[id]/song-pack` | GET | Latest Song Pack |
| `/api/live-prompt-game/sessions/[id]/export` | GET | Raw submissions as CSV |
| `/api/resonance/state` | GET, POST | Read and set the active field |
| `/api/resonance/hold` | POST | Record a completed hold |

There are no conductor or cueing APIs. Conductor state is `localStorage` only.

### Libraries and components

| File | Purpose |
|---|---|
| `data/livePromptGame.ts` | Client wrapper for every prompt-game endpoint |
| `data/signalPromptBlock.ts` | The Signal harmonic block and its stub Ableton trigger ids |
| `data/resonanceSignal.ts` | Field definitions and the fixed `resonance-live` slug |
| `lib/resonance-signal-store.ts` | Server store, with an in-memory fallback when Supabase is absent |
| `app/admin/conductor/[eventId]/ConductorView.tsx` | Stage purpose, cues, allowed modes, recovery move |
| `lib/song-garden-v2/haptics.ts` | `pulseHaptic()` — used by **Garden**, not by Live |

### Database

| Table | Defined in | Holds |
|---|---|---|
| `prompt_game_sessions` | `supabase/prompt-game-tables.sql` | `slug`, `name`, `state`, `current_round_id`, `linked_event_id`, `ended_at` |
| `prompt_game_rounds` | same, plus `supabase/prompt-round-prompt-block.sql` | `prompt_text`, `response_type`, limits, `closed_at`, `prompt_block` JSON |
| `prompt_game_submissions` | `supabase/prompt-game-tables.sql` | `device_id`, `raw_text`, `hidden`, `locked` |
| `prompt_game_votes` | same | Unique on `(submission_id, device_id)` |
| `prompt_game_ai_outputs` | same | `kind` and `payload`; also stores Composer's composition briefs |

RLS is enabled with no anon policies via `supabase/security-enable-rls-public-tables.sql`.

### Environment

`OPENAI_API_KEY` for Song Pack generation. Otherwise Supabase URL and service role key.

## 5. State of play

### Working

- **Game prompt sessions**: launch, QR, submit, reveal, vote, moderate, export — the full loop
- Pre-populated song-shape question queues (genre, mood, tempo, energy, style, theme)
- The display page as a join screen
- **Resonance**: field selection, hold interaction, haptics with graceful fallbacks

### Partial or prototype

- **Fishbowl is a label.** It uses the Game host UI unchanged
- **Signal is one harmonic voting prototype.** The Ableton trigger ids in
  `data/signalPromptBlock.ts` are stubs; there is no DAW wiring, no OSC
- **Conductor is an offline cheat sheet**, per-browser, not synced, not cueing or playback
- **Display shows a QR only** — it does not project prompts or results

### Not built

- Cueing engine, playback control, projection surfaces
- Moderation beyond hide and lock
- Any realtime transport

## 6. Rules and gotchas

1. **There is no realtime.** No Supabase channels, no `postgres_changes`, no SSE. Everything
   polls: host control room 2500ms, audience 2500ms, resonance admin 1500ms, resonance
   audience 850ms. Expect roughly a second of lag and design demos accordingly.
2. **Mode is the session `name`, not an enum.** The host UI branches on the strings `Game`,
   `Signal`, and `Fishbowl`. Renaming a session changes its behavior.
3. **Resonance reuses the prompt-game tables.** A fixed session slug `resonance-live`; field
   changes are rounds whose `prompt_text` is JSON `{ kind: "resonance-signal", ... }`; holds
   are submissions. Filter these out of session lists or they look like real games.
4. **Signal seeds fake submissions.** One per choice, with `device_id` values like
   `__signal_choice__:…`. Do not treat them as audience input.
5. **Voting rules differ by mode.** Non-Signal allows up to three votes per device per round
   and re-voting an already-voted phrase returns 400. Signal is a single vote that deletes
   the prior one.
6. **Phrase cards dedupe by lowercased text** and attach vote counts to the first submission
   id for that text. The card you see is not always the row you think.
7. **Device identity is anonymous `localStorage`** — `csc_live_device_id` and
   `csc_resonance_device_id`. Trivially resettable; do not build anything that assumes
   identity.
8. **`pulseHaptic()` is not the Resonance bridge.** The Garden buzz and the `/resonance`
   native protocol are separate systems.
9. **Resonance falls back to an in-memory store** when the Supabase admin client is missing.
   That works on one server instance and silently breaks across instances.
10. **Bloom is `events`.** The link column is `prompt_game_sessions.linked_event_id`.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Make the display page a real projection surface | It shows only a QR; a room screen should show prompts and results | `app/live/[slug]/display/page.tsx` |
| Give Fishbowl its own host controls | The mode exists in name only | `app/admin/live-prompt-game/sessions/[id]/page.tsx` |
| Decide whether Signal gets real DAW wiring | Trigger ids are stubs; `Protocols/tech-mapping-spec.md` describes the intended mapping | `data/signalPromptBlock.ts` |
| Move off polling | Sub-second collective response is impossible today | Supabase realtime, coordinate with OCTO |
| Give Resonance its own tables | Borrowing prompt-game tables makes both harder to reason about | `lib/resonance-signal-store.ts` |
| Sync conductor state across devices | One laptop only | `lib/experience/conductor-state.ts`, coordinate with ROOTS |

## 8. Handoff log

### 2026-09-06 — brief created

- Changed: nothing in the domain; this brief was written from a code survey.
- Learned: Resonance is implemented on top of the prompt-game schema under a fixed slug, which
  is not obvious from either feature's UI.
- Watch out: mode behavior keys off the session name string.
