# ROOTS Agent — hidden participation system

| | |
|---|---|
| **Admin home** | `/admin/roots` |
| **Public surface** | none directly; Roots shapes what Bloom and Live present |
| **Code prefixes** | `Protocols/`, `lib/experience`, `lib/participant-journey`, `lib/agent-llm.ts`, `app/admin/conductor` |
| **Primary tables** | `agent_themes`; otherwise Roots is encoded as code catalogs, not rows |
| **Reference docs** | every file in `Protocols/`, plus the Roots section of `docs/octo-living-system-workspace.md` |

## 1. Mission

Roots is the methodology under the product: how you invite people in, how much risk you ask
them to take, how you recognize what they gave, and how that ladders into deeper
participation. It is Joel's facilitation instinct and musical taste turned into something
reusable.

The core loop:

```text
Invitation -> Risk -> Contribution -> Recognition -> Response
  -> Collective effect -> Belonging -> Deeper participation
```

This agent owns the written protocols and the places where that methodology is actually
encoded in code. It is the domain most likely to be *thinking* work rather than shipping work.

## 2. Scope

### Owns

- All of `Protocols/` — the written methodology
- The experience plan and show arc catalog: `lib/experience/**`
- The conductor's advisory model: `app/admin/conductor/**`
- Participation-shaping logic: risk laddering in journey step design, consent defaults,
  question design, escalation and recovery
- The interview brief model conceptually — what a good `AgentBrief` contains
- `/admin/roots`

### Does not own

| Belongs to | When it comes up |
|---|---|
| BLOOM | The journey *machinery* — `EventForm`, `WorldJourney`, step rendering |
| LIVE | The runtime tools that execute a moment in the room |
| COMPOSER | What happens to contributions after they are collected |
| OCTO | Chrome and Settings |

The clean split: ROOTS decides what a good participation moment is; BLOOM and LIVE build the
surfaces that deliver it.

## 3. Start a new ROOTS agent

```text
You are the ROOTS agent for Crowdsource Choir. You own the hidden participation system:
invitation design, risk calibration, recognition, escalation and recovery, the show arc,
and the protocols that encode Joel's facilitation methodology.

Read these first:
- docs/agent-briefs/roots.md — your brief, including open threads
- every file in Protocols/ — the written methodology
- lib/experience/arc-catalog.ts — the methodology as executable data
- docs/octo-living-system-workspace.md — living-system vocabulary

Your work is often thinking and writing, not shipping. When methodology needs a surface,
name the domain that should build it (BLOOM for participant journeys, LIVE for runtime
tools) rather than building it here.

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

Roots is the domain where written methodology and shipped code diverge most, so this section
is the honest comparison.

| Roots claim | Written? | Implemented? |
|---|---|---|
| Seven-stage show arc and ceremony variant | `Protocols/show-arc.md` | Yes, as `arc-catalog.ts` plus the Conductor UI |
| Participation taxonomy and recovery hierarchy | `Protocols/participation-taxonomy.md` | Modes and recovery text are in the catalog; **not enforced at runtime** |
| Modular song A/B, locked tempo, Ableton scenes | Three Protocol files | **Not in product code.** No Ableton bridge, no song-module validator |
| Invitation, risk, contribution — digital | The OCTO loop | **Strong.** Journey, consent, media channels, prompt design |
| Recognition, response, collective effect | Protocols and the loop | Partial: song seeds, composition briefs, prompt-game voting, resonance |
| Belonging and deeper participation | OCTO Roots section | Conceptual. Garden persistence exists; no Roots engine |
| Sample to anthem, chant, warm-up | Protocols and Composer | Composition brief has chantable-line heuristics; warm-up logic is not a module |
| Facilitator decision patterns | Protocol recovery sections | Advisory conductor cues only |
| Signal thresholds | Protocols and the Roots page | Resonance field and Live signal exist; `signalAllowed` is advisory |
| A Roots workspace at `/admin/roots` | The OCTO map | **Placeholder.** One static page of links |

The short version: the live Root System — enforced modes, A/B lock-in, tech mapping, automated
escalation — is written down but not executable. Operators get guidance, not a closed loop.
What *is* shipping is the pre-show participation stack: journey, interview, consent,
composition.

## 6. Rules and gotchas

1. **`/admin/roots` is a hub, not a workspace.** `app/admin/roots/page.tsx` is a single static
   page linking to Conductor, Composition brief, Resonance, and Live. Do not assume it has
   CRUD or an editor.
2. **The conductor is advisory and says so.** It does not gate Live. Do not describe it as
   show control.
3. **Conductor state is per-browser `localStorage`.** Open it on a second laptop and you lose
   your place. It is not a shared operator surface.
4. **Scripted brief prompts beat the theme LLM.** For a normal interview the `askAboutItems`
   are returned verbatim. Changing a theme's system prompt usually changes nothing.
5. **A managed journey skips the LLM entirely.** Most real Blooms are managed.
6. **The emotional arc merges into S1, S4, and S7 only** — see `resolve-plan.ts`. It is not
   applied across all seven stages.
7. **Consent defaults on.** The gate applies unless `requireContributionConsent` is explicitly
   `false`.
8. **The interview version hash invalidates saved progress** when the brief or journey changes.
9. **`ParticipationModeId` deliberately omits Tier 3.** Pre-show free text is handled by the
   interview and journey instead of by a live mode.
10. **Two different things are called a brief.** The event-configuration `AgentBrief` shapes an
    interview. These domain handoff briefs are documentation. Say which one you mean.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Make `/admin/roots` a real workspace | The methodology has no editing surface; Protocols are edited as files | `app/admin/roots/page.tsx` |
| Enforce the participation taxonomy at runtime | Allowed modes are advisory strings; nothing stops a disallowed mode | `lib/experience/arc-catalog.ts`, coordinate with LIVE |
| Move conductor state off `localStorage` | Multi-operator and multi-device shows are impossible today | `lib/experience/conductor-state.ts` |
| Cite Protocol files from the code that implements them | Only `lib/experience/types.ts` does this; the link between doc and code is otherwise invisible | Add references in `arc-catalog.ts`, `journey-steps.ts` |
| Decide whether Stage 4 modular song is a build target | Three protocol files describe a system with no code at all | `Protocols/04-modular-song-creation.md` |

## 8. Handoff log

### 2026-09-06 — brief created

- Changed: nothing in the domain; this brief was written from a code and protocol survey.
- Learned: the doc-to-code gap is the defining fact of this domain, so the state-of-play table
  above is deliberately a comparison rather than a feature list.
- Watch out: it is easy to read `Protocols/` and believe the live system exists. It does not.
