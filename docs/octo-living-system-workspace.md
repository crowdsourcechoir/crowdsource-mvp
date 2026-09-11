# OCTO Living System Workspace

This workspace uses regenerative language to keep product, live experience, and
R&D work organized as one living system.

**OCTO** is the entire living organism — not a feature inside Crowdsource Choir.
Crowdsource Choir is the public face and wedge; OCTO is the operating system.
The company builds a **participatory entertainment** category and the
infrastructure that powers it (see `docs/crowdsource-platform-v2-plan.md`).

Category distinction:

- Experiential — I experience something
- Interactive — I make choices inside something someone else created
- Immersive — I enter a designed world
- **Participatory — my contribution becomes part of what is created**

Business layers (same organism, commercial view):

`SOURCE → CREATE → ACTIVATE → CAPTURE → AMPLIFY → PERSIST → SOURCE`

| Layer | OCTO home |
| --- | --- |
| SOURCE / PERSIST | Garden |
| CREATE | Composer (+ Roots) |
| ACTIVATE | Live + Bloom (+ Roots) |
| AMPLIFY / CAPTURE | Sales + export/media seams |

Song Garden is a **modality** on the Crowdsource Platform, not the platform itself.

## Core map

| Area | Meaning | Current admin home |
| --- | --- | --- |
| Garden | Persistent participatory world where contributions, memory, media, and identity live over time. | `/admin/gardens` |
| Bloom | Time-bound live event, gameday moment, or activation where a Garden comes alive. Existing code routes still use `events`. | `/admin/events` |
| Roots | Hidden participation methodology, musical intelligence, facilitation logic, and signal/response rules. | `/admin/roots` |
| Live | Runtime tools used during a Bloom: prompts, signal play, cueing, and live participation moments. | `/admin/live` |
| Composer | Where living inputs become musical compositions — songs, chants, anthems, and show material shaped from Garden/Bloom contributions. | `/admin/composer` |
| Sales | Commercial pipeline for teams, sponsors, events, partners, and proposals. | `/admin/sales` |

Together these form the living system: Gardens persist, Blooms activate, Roots
nourish, Live performs, Composer forms, and Sales distributes.

## Garden

A Garden is the persistent world. It can exist before, during, and after a live
activation. It stores the memory layer: contributions, public presence, chapters,
media, and evolving identity.

Gardens can be created for:

- places and communities
- teams and seasons
- events and conferences
- brands and sponsors
- themes or worlds

## Bloom

A Bloom is an event, but not merely a calendar entry. It is the moment when a
Garden becomes visible, musical, social, and alive.

A Bloom can:

- gather pre-event contributions
- activate a live room or gameday crowd
- generate anthem, chant, warm-up, projection, or sponsor moments
- leave behind new media, memory, and artifacts in the Garden

The data model and URLs still use `events` for stability, but the admin language
can say Bloom where it helps the system feel coherent.

## Roots

Roots are the participation system underneath the product. This is where Joel's
musical taste, facilitation instincts, and composition process become reusable
methodology.

Roots include:

- invitation design
- risk calibration
- contribution recognition
- sample-to-anthem transformation
- chant and warm-up logic
- facilitator decision patterns
- signal thresholds
- belonging and escalation design

The core loop:

```text
Invitation -> Risk -> Contribution -> Recognition -> Response
  -> Collective effect -> Belonging -> Deeper participation
```

## Live

Live is the runtime layer, not the whole event business. It is the control
surface for moments happening now.

Live tools may include:

- prompt sessions
- conductor views
- cueing
- playback
- moderation during a Bloom
- projection/display controls
- signal experiments

## Composer

Composer is where inputs turn into musical compositions. It is not the engine by
itself; it is the workspace where collected human presence is inspected,
arranged, curated, and formed into songs, chants, anthems, and show material
that Roots and Blooms need.

Keep the triad clear:

- **Composer** — the living-system domain / admin home / agent
- **Composition** — the process and artifacts (briefs, chant candidates, song seeds)
- **canvas** (lowercase) — spatial arrangement UI inside Composer, not a pillar name

Composer should support:

- audio and voice curation
- text/lyric/theme review
- photo, selfie, and video review
- anthem, chant, warm-up, and song preparation
- sponsor and gameday media moments
- Garden/Bloom composition prep

## Media contributions

Video and images are first-class contribution types, not attachments. A Garden
collects human presence in multiple forms:

- voice
- words
- sounds
- photos
- selfies
- submitted videos
- chants
- ambient moments

Every media contribution should eventually carry consent and usage metadata:

- public display allowed
- show/gameday use allowed
- sponsor use allowed
- social posting allowed
- moderation status
- Garden and Bloom association
- emotional/theme tags

## Agent organization

Use one persistent thread or agent per major living-system domain:

- OCTO Core Agent: coherence, philosophy, architecture
- Garden Agent: public Song Garden product, worlds, contributions, persistence
- Roots Agent: participation methodology and musical intelligence
- Bloom Agent: event/gameday activation design
- Live Tools Agent: runtime/operator software
- Composer Agent: musical formation — inputs into compositions, songs, and show material
- Sales Agent: offers, partnerships, sponsors, pitches

Implementation agents can be short-lived and task-specific, but this document
should remain the source of truth for workspace language.

Platform maturity and V2 community planning live in
`docs/crowdsource-platform-v2-plan.md`.

Gameday concurrency (QR stampede, media uploads at stadium scale) lives in
`docs/gameday-scale-strategy.md`.
