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
| **SOURCE** | Gather creative material | Garden (+ modality UX) | Gonzaga contributions; destination guests |
| **CREATE** | Turn contributions into entertainment | **Composer** (+ Roots methodology) | Gonzaga chant pipeline; production bottleneck |
| **ACTIVATE** | Live dramaturgy & collective effect | **Live** + Bloom + Roots | Gonzaga gameday; show design discipline |
| **PERSIST** | Between-event life; world evolves | **Garden** (persistent world) | Gonzaga season; Falcon’s Beyond duration |
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

1. Return to the same Garden across Blooms/chapters.
2. Discover prompts and selected contributions (hear/see what the community made).
3. Respond to contributions (reply / remix / react — start minimal).
4. Carry a **persistent identity** (not necessarily a full social profile).
5. Receive **recognition** when their material is selected, performed, or amplified (“I helped make that”).

Non-goals for V2:

- Full Creation Engine (V3)
- Hundreds of branded tenants (V4)
- Public “Story Garden / Movement Garden” product lines (keep as modality architecture only)
- Replacing Live dramaturgy or Sales CRM

---

## 4. Planning approach (how we build without fragmenting)

### Principle

Plan **one spine**, ship **modality-thin**, prove **with Gonzaga**, instrument **for Learfield**, leave **hooks for Falcon’s Beyond**.

### Phase order

```text
A. Spine contracts     → identity, contribution graph, recognition events, rights envelope
B. Garden as place     → community surfaces on existing persistent Garden
C. Recognition loop    → credit when CREATE/ACTIVATE/AMPLIFY uses a contribution
D. Measure             → Participation Index v0 (enough for Learfield conversations)
E. Modality template   → prove Chant (or second modality) shares the spine without a rewrite
```

Song Garden stays the first modality. Chant Garden (Gonzaga) is the best second instance to force the spine to be real.

### Slice ownership (route work, don’t fork the organism)

| Slice | Primary agent | Must not do |
| --- | --- | --- |
| Identity + recognition events | Garden Agent | Build a separate “social network” product |
| Community discovery / respond UX | Garden Agent | Bypass consent / rights |
| Producer select → credit back | Composer Agent | Invent lyrics that erase attribution |
| Live performance → capture → credit | Live + Bloom | Treat participation as a disposable activation |
| Sponsor / media inventory story | Sales Agent | Sell Amplify without SOURCE→CREATE integrity |
| Dramaturgy patterns | Roots Agent | Encode as hard-coded UI gimmicks |

### Laboratory mapping (same spine, different pressure)

| Laboratory | Pressure it reveals | V2 implication |
| --- | --- | --- |
| **Gonzaga** | Season persistence + chant dramaturgy + Hype Team | Community return + recognition + catalogue growth |
| **Learfield** | Sponsor-enabled participation → media inventory | Capture + attribution + measurement |
| **Falcon’s Beyond** | Place as instrument; long-duration world | Spatial contribution hooks; persist across visits |
| Conferences / enterprise | High volume + brand safety | Moderation + rights (prep for V4; don’t block V2) |

---

## 5. Foundation gaps (start contracts in V2, finish depth in V3/V4)

These were under-explicit. V2 should **introduce contracts**, not necessarily full systems.

### Identity

Persistent participant identity across contributions and Blooms.

Minimum: stable id + display credit name + device/account link path.  
Success signal: “Joel’s chant was performed; Joel sees it and contributes again.”

### Recognition + reputation

Selection and performance create status without gamified XP theater.

Minimum: credit lines on selected/performed artifacts; “created by the community” with individual credits when known.

### Rights infrastructure

Machine-readable permissions on every contribution (voice, likeness, derivative, commercial, sponsor, AI transform, social, DSP). Seeds exist; V2 must treat rights as **required fields on the contribution graph**, not footnotes.

### Moderation

Manual is fine for Gonzaga-scale V2. Design approval workflows so CES-scale doesn’t require a rewrite.

### Measurement — Participation Index (v0)

Move beyond submissions/views. First metrics:

- participation rate
- repeat participation
- selection → performance rate
- organic reuse / social propagation (manual OK at first)
- sponsor-enabled moment completion (Learfield-shaped)

Refine the named Index once two laboratories produce comparable data.

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

## 8. Immediate next planning decisions (for Joel)

Resolve these before large implementation:

1. **Identity model** — anonymous-first with optional claim, vs account-required for community features?
2. **Gonzaga as V2 pilot Garden** — one persistent Garden for the season; Song/Chant as modalities inside it?
3. **Recognition surface** — in-Garden only first, or also post-performance / social credit pack for Learfield?
4. **Respond primitive** — react, reply-in-kind, or remix? Pick one for V2.
5. **Participation Index v0** — which 3 metrics are contractually enough for Learfield conversations?

After those five, implementation can start with spine contracts (identity + contribution graph + recognition events) without boiling the ocean.

---

## 9. One-sentence north star

Build the shared participation spine so every Garden modality, every Bloom, and every laboratory partner deepens the same loop: **contribution becomes creation, creation becomes culture, culture invites deeper participation.**
