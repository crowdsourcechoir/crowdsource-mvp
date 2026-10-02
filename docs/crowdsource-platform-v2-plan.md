# Crowdsource Platform V2 — Planning Approach

Status: **planning** (not implementation)  
Owner lens: OCTO Core (coherence) → Garden / Composer / Live / Roots / Sales agents execute slices  
Depends on: `docs/octo-living-system-workspace.md`, Song Garden persistent world (Phases A–D)

---

## 0. The shift (lock this)

Crowdsource Choir is **not** a choir company scaling into more gigs.

It is building a **participatory-entertainment category** and the **infrastructure that powers it**.

| Adjacent category | What the person does |
| --- | --- |
| Experiential | Experiences something |
| Interactive | Makes choices inside something someone else created |
| Immersive | Enters a designed world |
| **Participatory** | **Contribution becomes part of what is created** |

Thesis:

> Participatory entertainment transforms audiences from spectators into creative participants—and uses their contributions to shape the experience itself.

Deeper line:

> We turn audiences into creators.

**Choir** = wedge modality (voice).  
**Song Garden** = first participation experience.  
**OCTO** = the living system / operating organism.  
**Crowdsource Platform** = the shared participation infrastructure under every experience.

Gonzaga, Learfield, and Falcon’s Beyond are not three products. They are laboratories revealing different layers of one system.

---

## 1. Name hygiene (prevent fragmentation)

Do not collide these:

| Name | Meaning |
| --- | --- |
| **OCTO** | Entire living system (Garden, Bloom, Roots, Live, Composer, Sales) |
| **Crowdsource Platform** | Shared participation infrastructure (multi-tenant, multi-modality) |
| **Garden** | Persistent participatory world (memory across Blooms) |
| **Song Garden / Chant Garden / …** | **Modalities** — participation experiences *on* the platform, inside a Garden |
| **Song Garden V2** (existing code) | WorldJourney UX cut — already shipped; not the same as Platform V2 |
| **Platform V2** (this plan) | Community layer: return, discover, respond, identity, recognition |

Song Garden is an **instance of the platform**, not the platform itself. Other gardens (chant, story, sound, movement) can share the same spine without public name sprawl yet.

---

## 2. Five business layers ↔ OCTO organs

The company has five layers. They map cleanly onto OCTO — do not invent a parallel org chart.

| Layer | Job | OCTO home | Partner laboratory |
| --- | --- | --- | --- |
| **SOURCE** | Gather creative material | Garden (+ modality UX) | Populus R&D; Gonzaga; destination guests |
| **CREATE** | Turn contributions into entertainment | **Composer** (+ Roots methodology) | Populus / Gonzaga production pipelines |
| **ACTIVATE** | Live dramaturgy & collective effect | **Live** + Bloom + Roots | Populus shows; Gonzaga gameday |
| **PERSIST** | Between-event life; world evolves | **Garden** (persistent world) | Populus series; Gonzaga season; Falcon’s Beyond |
| **AMPLIFY** | Media, sponsors, cultural spread | Sales + capture/export | **Learfield** inventory; social flywheel |

Business flywheel (commercial rhythm):

```text
SOURCE → CREATE → ACTIVATE → CAPTURE → AMPLIFY → PERSIST → SOURCE
```

Participation loop (human rhythm — Roots protects this):

```text
Invitation → Risk → Contribution → Recognition → Response
  → Collective effect → Belonging → Deeper participation
```

These nest: the business flywheel is how the company scales; the participation loop is how people stay human inside it. Amplify without Recognition becomes extraction. Persist without Belonging becomes a dead archive.

---

## 3. What Platform V2 means (scope lock)

Product maturity ladder (company language):

| Level | Name | Essence |
| --- | --- | --- |
| V1 | Contribution | Prompt → record → submit → consent → credit |
| **V2** | **Community** | Return place: discover, hear, respond, identity, recognition |
| V3 | Creation Engine | Clustering, hooks, generation, producer workspace, rights-aware AI |
| V4 | Enterprise Platform | Branded instances, campaign manager, analytics, APIs, venue/sponsor integrations |

**Platform V2 = Community.** Not V3 AI engine. Not V4 multi-tenant enterprise skin.

V1 is largely present (journey, clips, consent seeds). Persistent Garden (A–D) starts PERSIST. V2’s job is to make the Garden a **place people return to**, not a one-shot form.

### Platform V2 outcomes (definition of done)

A participant can:

1. Return to the same Garden across Blooms/chapters (when open-claim or account mode allows).
2. Discover prompts and selected contributions (hear/see what the community made).
3. **React** to contributions (reply/remix deferred).
4. Participate under the Garden’s identity mode: **open** (anonymous-first + claim) or **account-required**.
5. Receive **recognition** in-Garden and in post-performance / social credit when material is selected, performed, or amplified.

Non-goals for V2:

- Full Creation Engine (V3)
- Hundreds of branded tenants (V4)
- Public “Story Garden / Movement Garden” product lines (keep as modality architecture only)
- Replacing Live dramaturgy or Sales CRM

---

## 4. Planning approach (how we build without fragmenting)

### Principle

Plan **one spine**, ship **modality-thin**, prove **with Populus R&D shows**, instrument **for Learfield**, leave **hooks for Gonzaga season and Falcon’s Beyond**.

### Phase order

```text
A. Spine contracts     → identity modes, contribution graph, recognition events, rights envelope
B. Garden as place     → community surfaces on existing persistent Garden
C. Recognition loop    → credit in-Garden + post-performance / social pack
D. Measure             → Participation Index v0 (sponsor-sellable for Learfield)
E. Modality template   → second modality shares the spine without a rewrite
```

Song Garden stays the first modality. Populus Blooms are the near-term R&D laboratory. Gonzaga remains a season-scale laboratory when ready — not a required V2 gate.

### Slice ownership (route work, don’t fork the organism)

| Slice | Primary agent | Must not do |
| --- | --- | --- |
| Identity modes + recognition events | Garden Agent | Build a separate “social network” product |
| Community discovery + react UX | Garden Agent | Bypass consent / rights |
| Producer select → credit back | Composer Agent | Invent lyrics that erase attribution |
| Live performance → capture → credit | Live + Bloom | Treat participation as a disposable activation |
| Sponsor / media inventory story | Sales Agent | Sell Amplify without SOURCE→CREATE integrity |
| Dramaturgy patterns | Roots Agent | Encode as hard-coded UI gimmicks |

### Laboratory mapping (same spine, different pressure)

| Laboratory | Pressure it reveals | V2 implication |
| --- | --- | --- |
| **Populus shows** | Fast R&D across multiple Blooms | Primary V2 pilot surface; iterate identity + react + recognition |
| **Gonzaga** | Season persistence + chant dramaturgy + Hype Team | Catalogue growth; season Persist (when scheduled) |
| **Learfield** | Sponsor-enabled participation → media inventory | Capture + dual recognition + Participation Index |
| **Falcon’s Beyond** | Place as instrument; long-duration world | Spatial contribution hooks; persist across visits |
| Conferences / enterprise | High volume + brand safety | Moderation + account-required mode (prep for V4) |

---

## 5. Foundation gaps (start contracts in V2, finish depth in V3/V4)

These were under-explicit. V2 should **introduce contracts**, not necessarily full systems.

### Identity (both modes)

Identity is **configurable per Garden / Bloom / campaign**, not a global either/or:

| Mode | When | Behavior |
| --- | --- | --- |
| **Open** | Populus-style / low-friction public | Anonymous-first contribution; optional later **claim** to attach credit and return identity |
| **Account-required** | Enterprise, brand-safety, rights-heavy, some sponsor campaigns | Must sign in / register before contributing or reacting |

Spine must support both from day one. Do not ship two separate products.

### Recognition + reputation

Recognition is **dual-surface**:

1. **In-Garden** — credit on selected contributions, community presence, “I helped make that” inside the world
2. **Post-performance / social** — credit packs for capture, Learfield-shaped sponsor moments, and outbound media

Selection and performance create status without gamified XP theater.

### Rights infrastructure

Machine-readable permissions on every contribution (voice, likeness, derivative, commercial, sponsor, AI transform, social, DSP). Seeds exist; V2 must treat rights as **required fields on the contribution graph**, not footnotes. Account-required mode may demand stronger consent upfront; open mode still records a rights envelope per contribution.

### Moderation

Manual is fine for Populus-scale V2. Design approval workflows so CES-scale doesn’t require a rewrite. Account-required mode can attach clearer moderation / brand-safety gates.

### Respond primitive (V2)

**React only.** Reply and remix wait. Reactions feed recognition and Participation Index without opening a full social graph.

### Measurement — Participation Index (v0)

Learfield sells this property to sponsors. Index must be **participation metrics**, not vanity views.

Three sponsor-sellable metrics (v0):

| Metric | Definition (plain) | Why sponsors buy it |
| --- | --- | --- |
| **Participation rate** | Contributors ÷ reachable audience (or attendees for that Bloom) | “What % of the room/community actually created?” |
| **Sponsored participation volume** | Contributions + reacts inside a sponsor-enabled moment / campaign window | “How much creative activity did the brand enable?” |
| **Activation reach** | People who performed / encountered the resulting piece live or in captured media (with credit path back to contributors) | “Did participation become entertainment that others experienced?” |

Supporting counters (instrument now, name later): repeat participation, selection→performance rate, social credit-pack reach.

Refine the branded Index once Populus + one rights partner produce comparable data.

---

## 6. CREATE and ACTIVATE (adjacent, not V2 scope — but plan the seams)

### Creation Engine (V3 seam)

```text
submissions → cluster → hooks → chant/song candidates
  → producer refine → Hype Team test → deploy
```

Composer owns this. V2 must emit **structured contribution + theme tags + rights** so V3 doesn’t scrape blobs.

### Participatory Show Design (Activate discipline)

Energy arcs, thresholds, call-and-response, recovery, sponsor integration, closing rituals.

Roots + Live own this. V2 must support **low-friction return participation** between shows so Activate has living material, not a cold start each Bloom.

### Place as instrument (Falcon’s Beyond seam)

People as instruments **and** place as instrument. V2 identity + contribution graph should allow `place` / zone / environment as a future contribution target without implementing spatial audio now.

---

## 7. Four business engines (keep Sales coherent)

| Engine | What it sells |
| --- | --- |
| Experiences | Major participatory productions |
| Platform | Licensed participation infrastructure |
| Creative system + services | Show design, direction, training, integration |
| Media + IP | Music, video, formats, sponsorship, catalogues |

Platform V2 strengthens the Platform and Media engines without abandoning Experiences. Sales language should shift from “choir gig” to **participatory entertainment infrastructure + practice**.

---

## 8. Locked decisions (Joel — 2026-08-26)

| Decision | Lock |
| --- | --- |
| **Identity** | **Both** — open (anonymous-first + claim) and account-required; configurable per Garden/Bloom/campaign |
| **V2 pilot laboratory** | **Populus shows** for R&D — not gated on Gonzaga. Gonzaga remains a season-scale lab when ready |
| **Recognition** | **Both** — in-Garden credit and post-performance / social credit packs (Learfield-ready) |
| **Respond primitive** | **React** for V2; reply/remix deferred |
| **Participation Index v0** | Three sponsor-sellable participation metrics: **participation rate**, **sponsored participation volume**, **activation reach** |

### Next implementation cut (after merge)

1. Identity mode flag on Garden/Bloom + anonymous id / claim / account paths  
2. Contribution graph events that emit recognition (select, perform, amplify)  
3. React primitive on discoverable contributions  
4. Dual credit surfaces (Garden + exportable social/performance pack)  
5. Instrument the three Index metrics on Populus Blooms  

---

## 9. One-sentence north star

Build the shared participation spine so every Garden modality, every Bloom, and every laboratory partner deepens the same loop: **contribution becomes creation, creation becomes culture, culture invites deeper participation.**
