# OCTO Living System Workspace

This workspace uses regenerative language to keep product, live experience, and
R&D work organized as one living system.

## Core map

| Area | Meaning | Current admin home |
| --- | --- | --- |
| Garden | Persistent participatory world where contributions, memory, media, and identity live over time. | `/admin/gardens` |
| Bloom | Time-bound live event, gameday moment, or activation where a Garden comes alive. Existing code routes still use `events`. | `/admin/events` |
| Roots | Hidden participation methodology, musical intelligence, facilitation logic, and signal/response rules. | `/admin/roots` |
| Live | Runtime tools used during a Bloom: prompts, signal play, cueing, and live participation moments. | `/admin/live` |
| Canvas | Creative/admin workspace for arranging, curating, composing, and preparing Garden/Bloom material. | `/admin/canvas` |
| Sales | Commercial pipeline for teams, sponsors, events, partners, and proposals. | `/admin/sales` |

Together these form the living system: Gardens persist, Blooms activate, Roots
nourish, Live performs, Canvas holds the creative workspace (Composer Agent
forms material there), and Sales distributes.

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

## Canvas (creative workspace)

Canvas is the creative workspace where collected material becomes usable. It is
the place to inspect, arrange, curate, and prepare material that Roots and
Blooms need. Admin home today: `/admin/canvas`.

Canvas should support:

- audio and voice curation
- text/lyric/theme review
- photo, selfie, and video review
- anthem, chant, and warm-up preparation
- sponsor and gameday media moments
- Garden/Bloom composition prep

### Composer Agent (not the Canvas)

The **Composer Agent** works *inside* Canvas but is not Canvas. Canvas is the
workspace; Composer is the arranger, curator, and translator of human
contribution — listening for emotional center, hooks, motifs, and material
people can recognize themselves inside.

Keep the distinction clear:

- **Canvas** — creative workspace surface (tools, review, arrangement)
- **Composer Agent** — musical/visual/experiential formation intelligence
- **Composition** — process and artifacts (`lib/composition`, briefs, chant candidates, song seeds)

Starter prompt: [`docs/agents/composer.md`](./agents/composer.md).

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
- Live Agent: runtime/operator software
- Composer Agent: turns participation into music, visuals, and Bloom material (works inside Canvas; is not Canvas)
- Sales Agent: offers, partnerships, sponsors, pitches

Copy-paste starter prompts live in [`docs/agents/`](./agents/README.md).
Composer Agent prompt: [`docs/agents/composer.md`](./agents/composer.md).

Implementation agents can be short-lived and task-specific, but this document
should remain the source of truth for workspace language.
