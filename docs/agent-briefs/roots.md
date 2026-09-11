# ROOTS Agent — the Root System

| | |
|---|---|
| **Admin home** | `/admin/roots` |
| **Public surface** | none directly; Roots shapes what Bloom and Live present |
| **Code prefixes** | `Protocols/`, `lib/experience`, `lib/participant-journey`, `lib/agent-llm.ts`, `app/admin/conductor` |
| **Primary tables** | `agent_themes`; otherwise Roots lives as catalogs and protocols |
| **Reference docs** | every file in `Protocols/`, plus the Roots section of `docs/octo-living-system-workspace.md` |

## 1. Mission

Roots is the living methodology under Crowdsource Choir: how people are invited in, how much
risk they are asked to take, how what they give is recognized, and how that ladders into
belonging and deeper participation. It is Joel's facilitation instinct and musical taste
made reusable — so every Bloom and every Live moment can draw from the same Root System.

The core loop:

```text
Invitation → Risk → Contribution → Recognition → Response
  → Collective effect → Belonging → Deeper participation
```

This agent tends that loop in writing (`Protocols/`) and in code (`lib/experience`, journey
design, conductor). Where the methodology is ahead of the product, Roots keeps the north star
clear and names what Bloom and Live should grow into next.

## 2. Scope

### Owns

- All of `Protocols/` — the written Root System
- The experience plan and show-arc catalog: `lib/experience/**`
- The conductor's advisory model: `app/admin/conductor/**`
- Participation-shaping logic: risk laddering in journey steps, consent defaults, question
  design, escalation and recovery
- The interview brief model conceptually — what a good `AgentBrief` contains
- `/admin/roots` as the Roots home, growing toward a full methodology workspace

### Does not own

| Belongs to | When it comes up |
|---|---|
| BLOOM | The journey *machinery* — `EventForm`, `WorldJourney`, step rendering |
| LIVE | The runtime tools that execute a moment in the room |
| COMPOSER | What happens to contributions after they are collected |
| OCTO | Chrome, Settings, and cross-system verification after changes |

The clean split: Roots decides what a good participation moment *is*; Bloom and Live build
the surfaces that deliver it; OCTO verifies the whole still coheres afterward.

## 3. Start a new ROOTS agent

```text
You are the ROOTS agent for Crowdsource Choir. You own the Root System — invitation design,
risk calibration, recognition, escalation and recovery, the show arc, and the protocols that
encode Joel's facilitation methodology.

Read these first:
- docs/agent-briefs/roots.md — your brief, including open threads
- every file in Protocols/ — the written methodology (this is the north star)
- lib/experience/arc-catalog.ts — the methodology as executable data
- docs/octo-living-system-workspace.md — living-system vocabulary

Hold the aspiration and the current maturity at once. Protocols/ describe the Root System we
are growing into; lib/experience and the pre-show journey are what already embody it. When
methodology needs a new surface, name the domain that should build it (BLOOM for participant
journeys, LIVE for runtime tools) rather than building it here — then let OCTO verify the
seam.

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### The protocols

| File | What it specifies |
|---|---|
| `Protocols/show-arc.md` | The show as a repeatable container, not a song. Seven stages: Arrival, Activation, Hooks Medley, Modular Song, Genre Shift, EDM Peak, Return. Stage 4 alone makes a ceremony |
| `Protocols/participation-taxonomy.md` | The allow-list of audience modes. Tier 1 always safe (unison, call and response, A/B, sectional split); Tier 2 careful (volume sculpt, layers, controlled sample); Tier 3 restricted (pre-show free text, spatial shift). Includes prohibitions and the recovery hierarchy back to unison |
| `Protocols/04-modular-song-creation.md` | The Stage 4 engine: fixed chord bed, A/B melodies and lyrics, locked tempo, sub-30-second binary votes, leader authority. Participation is structured selection, not invention |
| `Protocols/song-module-spec.md` | Hard constraints for Stage 4 songs: four chords or fewer, looping harmonic bed, 85–115 BPM, 4–8 bar hooks, 6–8 syllables per line, equal-strength A/B variants, no bridges |
| `Protocols/tech-mapping-spec.md` | Ableton scene naming, clip groups, lighting and haptics fallbacks. Protocol over spectacle; explicit operator-load limits |
| `Protocols/resonance-native-haptics-bridge.md` | How a native shell attaches to the web `/resonance` surface for real haptics |

### Methodology encoded as code

| File | What it encodes |
|---|---|
| `lib/experience/arc-catalog.ts` | The show arc as data: per stage purpose, emotional target, allowed participation modes, max beats, whether signal is allowed, rest beat, composition outputs, transition cue, recovery move. Arcs are `full_show` (S1–S7) and `ceremony` (S1, S4, S7) |
| `lib/experience/types.ts` | `ParticipationModeId` mirrors the taxonomy tiers; this is the only code that cites a Protocol file by name |
| `lib/experience/resolve-plan.ts` | Resolves an arc and merges an event's `emotionalArc` onto S1, S4, and S7 only |
| `lib/experience/pacing.ts` | Beat budget, rest, and signal gates |
| `lib/experience/conductor-state.ts` | Persists conductor position in `localStorage` under `octo_conductor_state_v1_{eventId}` |
| `lib/songgarden/journey-steps.ts` | The digital risk ladder: name, then text, voice, or video prompts, then optional sound pads; channel toggles and record caps |
| `lib/participant-journey/contribution-consent.ts` | Consent gate, on by default |
| `lib/participant-journey/example-words.ts` | Soft response hints that lower the risk of a blank field |
| `lib/agent-llm.ts` | Interview engine: builds the system prompt from theme template plus event brief, enforces one question per turn and a max question count |
| `lib/agent-name-question.ts` | Name collection defaults and detection |

### The interview brief system

This is the *event-configuration* brief — a different thing from these domain handoff briefs.

`AgentBrief` in `data/agentInterview.ts` holds `eventName`, `eventType`, `whoWhat`,
`emotionalArc`, `collectName`, `nameQuestionPrompt`, `requireContributionConsent`,
`contributionConsentText`, `askAbout`, `askAboutItems`, `avoid`, and `exampleAnswers`.

How a theme and a brief combine:

1. The event row stores `agent_theme_id` and `agent_brief`.
2. On the first message of a non-managed journey, the send route loads the theme and calls
   `getNextAgentMessage`.
3. `buildSystemPrompt` in `lib/agent-llm.ts` concatenates the theme's `system_prompt_template`,
   the event title, `whoWhat`, `emotionalArc`, ask-about guidance, the max question count,
   the do-and-don't rules, and the JSON response contract.
4. **In practice the LLM rarely drives.** If the brief has `askAboutItems` or `askAbout`, those
   prompts are returned verbatim in order. The theme prompt colors only the fallback path.
5. When journey steps resolve, `lib/agent-journey-managed.ts` bypasses the LLM entirely.

Seeded themes in `supabase/agent-interview-tables.sql`: `birthday`, `conference`, `fundraiser`.

### Conductor

`/admin/conductor/[eventId]` loads the Bloom, resolves the plan, and renders `ConductorView`.
`app/admin/conductor/[eventId]/ConductorPageClient.tsx` controls the arc preset, current stage,
participation beats, and the rest beat. `ConductorView.tsx` shows stage purpose, emotional
target, transition cue, allowed modes, composition outputs, recovery move, and pacing budget.

It is explicitly advisory. It does not gate Live tools.

## 5. State of play

The Root System is real in methodology and growing in product. Hold both truths.

### Alive now

- Seven-stage show arc and ceremony variant — `Protocols/show-arc.md` embodied in
  `lib/experience/arc-catalog.ts` and the Conductor UI
- Pre-show participation stack — journey, consent, media channels, prompt design
- Interview brief model and seeded themes (`birthday`, `conference`, `fundraiser`)
- Advisory conductor with stage purpose, emotional target, recovery moves, pacing budget
- Participation taxonomy written and mirrored as `ParticipationModeId` in code

### Growing now

- Recognition and collective effect — song seeds, composition briefs, prompt-game voting,
  and resonance are early forms of the loop's later stages
- `/admin/roots` as a true methodology workspace (today: a focused hub linking Conductor,
  Composition brief, Resonance, and Live)
- Runtime enforcement of the participation taxonomy (today: modes and recovery live in the
  catalog as guidance for operators)
- Shared conductor state across devices (today: per-browser `localStorage`)

### Growing into

- Full Stage 4 modular song — A/B lock-in, locked tempo, Ableton scene mapping, as specified
  in the three Stage 4 protocol files
- Automated escalation and recovery that closes the live loop, not only advises it
- Belonging and deeper-participation mechanics beyond Garden persistence
- Warm-up / chant / sample-to-anthem as first-class Roots modules feeding Composer
- Signal thresholds that actively shape Live, not only annotate it

Protocols/ are the destination. The pre-show stack and the arc catalog are the path already
underfoot.

## 6. Rules and gotchas

1. **Treat `Protocols/` as the north star.** When product and protocol disagree, name the gap
   and grow toward the protocol — do not quietly shrink the protocol to match the current UI.
2. **`/admin/roots` is the Roots home, still growing.** `app/admin/roots/page.tsx` is a hub of
   links today; the open thread is to make it an editable methodology workspace. Do not assume
   CRUD exists yet.
3. **The conductor advises; Live executes.** Conductor does not gate Live tools. Describe it as
   facilitation guidance, not show control.
4. **Conductor state is per-browser `localStorage`.** A second laptop will not share your place.
   Multi-operator shows need the shared-state thread in section 7.
5. **Scripted brief prompts beat the theme LLM.** For a normal interview the `askAboutItems`
   are returned verbatim. Changing a theme's system prompt usually changes nothing.
6. **A managed journey skips the LLM entirely.** Most real Blooms are managed.
7. **The emotional arc merges into S1, S4, and S7 only** — see `resolve-plan.ts`. Extending it
   across all seven stages is a Roots growth opportunity.
8. **Consent defaults on.** The gate applies unless `requireContributionConsent` is explicitly
   `false`.
9. **The interview version hash invalidates saved progress** when the brief or journey changes.
10. **`ParticipationModeId` deliberately omits Tier 3.** Pre-show free text is handled by the
    interview and journey — that is intentional design, not a missing enum value.
11. **Two different things are called a brief.** The event-configuration `AgentBrief` shapes an
    interview. These domain handoff briefs are documentation. Say which one you mean.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Grow `/admin/roots` into a methodology workspace | Give the Root System an editing home, not only file-based protocols | `app/admin/roots/page.tsx` |
| Enforce the participation taxonomy at runtime | Turn allow-lists into Live/Bloom guardrails, coordinated with LIVE | `lib/experience/arc-catalog.ts` |
| Share conductor state across devices | Multi-operator and multi-device shows | `lib/experience/conductor-state.ts` |
| Cite Protocol files from the code that embodies them | Make the north-star link visible; only `lib/experience/types.ts` does this today | `arc-catalog.ts`, `journey-steps.ts` |
| Build toward Stage 4 modular song | Three protocol files already specify A/B lock-in, tempo, and Ableton mapping | `Protocols/04-modular-song-creation.md` |

## 8. Handoff log

### 2026-09-06 — reframed aspirationally

- Changed: state of play rewritten as Alive / Growing / Growing into; Protocols positioned as
  the north star; kickoff and rules updated so agents hold aspiration and maturity together.
- Learned: Joel wants Roots to read as the Root System we are becoming, not as a gap report.
  Honesty about maturity stays; the frame is growth, not absence.
- Watch out: still do not pretend Stage 4 Ableton lock-in or runtime taxonomy enforcement
  already ship — name them as Growing into.

### 2026-09-06 — brief created

- Changed: nothing in the domain; this brief was written from a code and protocol survey.
- Learned: Roots is where methodology leads product — the comparison table (now reframed)
  is the useful artifact.
- Watch out: reading `Protocols/` alone can overstate what Live enforces today; pair it with
  section 5.