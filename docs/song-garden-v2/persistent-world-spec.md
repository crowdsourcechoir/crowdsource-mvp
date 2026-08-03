# Song Garden Persistent World — Spec (v0)

Status: **implemented through Phase D** (A–D in repo; external print fulfillment still deferred)  
Depends on: `docs/song-garden-v2/architecture.md` (V2 WorldJourney, WorldConfig, local growth)  
Consumers: Crowdsource Choir series runs · Crowdsource Fans team seasons · commerce (edition + living merch)  
**Testing:** [`TESTING.md`](./TESTING.md)

---

## 0. Product intent

Song Garden becomes a **persistent shared world** that outlives a single show or game.

- A **Garden** spans a run (e.g. 6 shows) or a season.
- **Contributions mutate a canonical world state** visible to every participant.
- Shows / gamedays are **chapters inside the world**, not disposable gardens that reset.
- The same world state later powers **monetization** (monthly edition hoodie; on-demand one-of-one hoodie).

Today (V2): growth nodes are **per-device localStorage**; energy is **personal journey progress**; storyboard frames are **per-event**. The feeling is right; shared persistence is not.

This spec defines the platform cut that makes the world real.

---

## 1. Goals & non-goals

### Goals (Phase A–C)

1. **Garden entity** with canonical mutable state.
2. **Chapters** that bind existing `events` into a run without breaking `/e/[slug]`.
3. **Contribution → mutation** pipeline: every accepted contribution applies a typed delta.
4. **World snapshot** API: deterministic renderable state at any time (UI + commerce).
5. **Personal marks + shared field**: you still see “your” growth; everyone sees the garden change.
6. Clear extension points for **Crowdsource Fans zones** and **merch SKUs** without implementing them in Phase A.

### Non-goals (defer)

- Full stadium seat maps, sponsor CRM, or team multi-tenant admin (Fans track).
- Realtime websockets (poll/SSE first).
- Full remix / social graph / public leaderboards.
- Live print fulfillment integration (Shopify/Printful) — snapshot contract only in Phase C.
- Replacing Conductor / composition / Live Prompt Game.

---

## 2. Core concepts

```
Garden
  └── Chapters[]          (each chapter ↔ one Event slug today)
  └── WorldState          (canonical, versioned, mutated by contributions)
  └── BrandKit            (colors, logo, hero, optional storyboard base)
  └── MutationLog[]       (append-only audit of applied deltas)
  └── Snapshots[]         (optional pinned editions for commerce)

ParticipantMark           (device/session-scoped “my nodes” — can later bind to account)
Contribution              (existing clip / interview turn — source of mutations)
```

### 2.1 Garden

A long-lived world container.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text unique | Public: `/g/[gardenSlug]` (future) or resolve via chapter event |
| `title` | text | e.g. “ETHGlobal Garden 2026”, “City FC Song Garden” |
| `kind` | `series` \| `season` \| `evergreen` | Choir run vs sports season vs open garden |
| `status` | `draft` \| `live` \| `archived` | |
| `brand_kit` | jsonb | See §4 |
| `world_state` | jsonb | Canonical state blob (§5) — hot path; also mirrored in `garden_world_states` if split |
| `world_version` | int | Monotonic; bumps on every applied mutation |
| `mutation_policy` | jsonb | Caps, weights, chapter multipliers (§6) |
| `commerce` | jsonb \| null | Edition config hooks (§10) |
| `created_at` / `updated_at` | timestamptz | |

### 2.2 Chapter

A time-bounded ritual **inside** a Garden. Phase A maps 1:1 to an existing `events` row.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `garden_id` | uuid FK | |
| `event_id` | text/uuid FK → `events` | Keeps `/e/[slug]` working |
| `index` | int | 1..N show order |
| `label` | text | “Show 1”, “Opening Day”, “Rivalry Week” |
| `opens_at` / `closes_at` | timestamptz \| null | Contribution window (optional) |
| `chapter_weight` | number | Default `1`; finale can be `1.5` |
| `status` | `upcoming` \| `open` \| `closed` | |

**Rule:** An event may belong to at most one chapter. Events without a chapter keep today’s single-event behavior (backward compatible).

### 2.3 Why not only `events`?

Series persistence, between-show life, shared energy, and merch editions need a parent that **does not reset** when a show ends. Chapters hang events off Gardens so V2 journeys stay event-scoped while the world is garden-scoped.

---

## 3. Migration from current V2 behavior

| Current | Persistent world |
|---|---|
| `WorldConfig` on `events.world_config` | Becomes **BrandKit defaults** + optional chapter skin; Garden holds the living state |
| `energyLevel = completed/total` (personal) | **Personal progress** still drives journey UX; **Garden energy** is aggregate |
| `WorldGrowthNode` in `localStorage` | **ParticipantMark** server-side (device id); optional local cache |
| Storyboard frames snapped by personal progress | Dual mode: chapter journey storyboard **or** garden bloom stage from shared energy |
| `/api/events/[id]/activity` counts | Feeds mutations + presence; not the source of truth for visuals |

**Backward compatibility**

- No chapter → identical to today (local growth OK until Phase A ships marks).
- With chapter → client reads Garden snapshot for shared layers; still writes personal marks.

---

## 4. BrandKit

Static identity. Does not change from contributions (mutations change `WorldState`, not brand).

```ts
type BrandKit = {
  title: string;
  logoUrl: string | null;
  primaryColor: string;      // default #1a0f2d
  accentColor: string;       // default #CFFF81
  heroArtworkUrl: string | null;
  animationPreset: "particles" | "aurora" | "glow" | "none";
  ambientSoundtrackUrl: string | null;
  /** Base storyboard / scene ladder for the garden (not personal journey). */
  bloomStoryboard: WorldStoryboardFrame[]; // reuse existing frame type
  /** Fans extension — ignored by Choir until used */
  zones?: ZoneDef[];         // see §11
};
```

Admin Phase A: copy from linked event’s `worldConfig` into Garden on create; allow edit on Garden.

---

## 5. WorldState (canonical)

The hot object every client and commerce job reads.

```ts
type WorldState = {
  version: number;
  updatedAt: string; // ISO

  /** 0..1 aggregate vitality — drives bloom stage + merch palette intensity */
  energy: number;

  /** Soft counters (display + thresholds). Not a leaderboard. */
  totals: {
    contributions: number;
    participants: number;
    byKind: Partial<Record<ContributionKind, number>>;
  };

  /** Shared growth field — sampled/aggregated for render, not one node per clip forever */
  field: {
    /** Dense enough to feel alive; capped for payload size */
    nodes: SharedGrowthNode[];
    /** Running phyllotaxis index cursor */
    nextIndex: number;
  };

  /** Discrete garden landmarks unlocked by thresholds or chapter finales */
  landmarks: Landmark[];

  /** Layer intensities 0..1 — map contribution kinds → visible weather/flora/sound */
  layers: {
    percussion: number;  // rhythm / ground
    vocal: number;       // choir / air
    voice: number;       // spoken stories
    text: number;        // words / signage density
    video: number;       // light / screens
    other: number;
  };

  /** Chapter progress bookkeeping */
  chapters: {
    completedIds: string[];
    activeChapterId: string | null;
  };

  /** Deterministic seed for generative art / merch (stable until explicit edition pin) */
  renderSeed: string;
};
```

```ts
type ContributionKind =
  | "text" | "voice" | "video"
  | "percussion" | "vocal" | "other";

type SharedGrowthNode = {
  id: string;
  kind: ContributionKind;
  index: number;
  /** 0..1 weight after decay/cap policy */
  weight: number;
  chapterId: string | null;
  createdAt: string;
};

type Landmark = {
  id: string;
  key: string;           // e.g. "north_grove", "rivalry_gate"
  label: string;
  unlockedAt: string;
  unlockedBy: "threshold" | "chapter" | "manual";
};
```

### Payload budget

- Cap `field.nodes` at **N = 240** (tune). When exceeded, compact: merge oldest into layer mass, keep recent + landmark-linked nodes.
- Snapshot API never returns raw media — only state + brand URLs.

---

## 6. Mutation rules

### 6.1 Pipeline

```
Accepted contribution (existing APIs succeed)
  → emit WorldMutationIntent { gardenId, chapterId?, kind, sourceType, sourceId, deviceId }
  → authorize (garden live, chapter open if required, rate limit)
  → applyMutation(state, intent, policy) → { nextState, effects[] }
  → persist state + append mutation_log (+ participant_mark)
  → return effects to client for celebration copy (“The north grove brightened”)
```

**Source hooks (Phase A)** — after success paths already in `WorldJourney`:

- `submitSonggardenClip` success → kind from pad category (`percussion` / `vocal` / …)
- interview `sendMessage` with text/voice/video → matching kind

Prefer a single server function `recordGardenContribution(...)` called from those API routes when `event.chapter → garden` exists. Client must not be the source of truth for shared state.

### 6.2 Delta math (v0 policy)

Configurable on `garden.mutation_policy`; defaults:

```ts
type MutationPolicy = {
  energyPerContribution: number;     // default 0.012
  energyCap: number;                 // 1
  layerGain: number;                 // 0.02 per matching kind
  layerCap: number;                  // 1
  chapterWeightDefault: number;      // 1
  /** Landmark unlocks: energy thresholds and/or contribution counts */
  landmarks: Array<{
    key: string;
    label: string;
    minEnergy?: number;
    minContributions?: number;
    minChapterIndex?: number;
  }>;
  /** Shared field */
  maxNodes: number;                  // 240
  nodeWeight: number;                // 1
  /** Diminishing returns for same device in short window */
  deviceDamping: {
    windowMinutes: number;           // 30
    afterCount: number;              // 5
    factor: number;                  // 0.35
  };
};
```

**Apply (pseudocode):**

```
w = chapter.chapter_weight * deviceDampingFactor(deviceId)
energy' = min(cap, energy + energyPerContribution * w)
layers[kind]' = min(cap, layers[kind] + layerGain * w)
totals...
append SharedGrowthNode (or compact)
unlock landmarks if thresholds crossed
version++
if effects include landmark → include in response
```

**Readable consequence (required):** each response may include 0..2 `effects` for UI:

```ts
type WorldEffect =
  | { type: "energy_up"; delta: number }
  | { type: "layer_up"; kind: ContributionKind; level: number }
  | { type: "landmark_unlocked"; key: string; label: string }
  | { type: "chapter_bloom"; chapterId: string };
```

CelebrationBurst stays; optionally show one line from `effects`.

### 6.3 What contributions do *not* do (v0)

- No free-form user placement on a map.
- No overwriting BrandKit.
- No deleting others’ nodes (moderation = hide source media; field may tombstone later).
- No XP / public ranked leaderboard.

---

## 7. Participant marks (personal layer)

Replaces localStorage as source of truth when Garden is linked.

```ts
type ParticipantMark = {
  id: string;
  gardenId: string;
  deviceId: string;
  kind: ContributionKind;
  index: number;          // personal spiral index
  sourceType: "clip" | "turn";
  sourceId: string;
  createdAt: string;
};
```

Client render:

1. **Shared:** `WorldState.field` + `layers` + `energy` → bloom / ambient.
2. **Personal:** `ParticipantMark[]` for this device → brighter/foreground nodes (reuse phyllotaxis helper).

Anonymous device id: keep existing Song Garden device id pattern from clip submission.

---

## 8. APIs

All server-side; follow existing service-role Supabase pattern.

### 8.1 `GET /api/gardens/[gardenIdOrSlug]/snapshot`

**Purpose:** Single read model for UI + future commerce.

Query:

- `at` (optional ISO) — historical: nearest snapshot ≤ t, or rebuild from log (Phase B)
- `chapterId` (optional) — include chapter metadata
- `deviceId` (optional) — include `myMarks`

Response:

```ts
type GardenSnapshot = {
  garden: {
    id: string;
    slug: string;
    title: string;
    kind: string;
    status: string;
    worldVersion: number;
  };
  brand: BrandKit;
  state: WorldState;
  activeChapter: null | {
    id: string;
    index: number;
    label: string;
    eventId: string;
    eventSlug: string;
    status: string;
  };
  myMarks: ParticipantMark[]; // empty if no deviceId
  /** Convenience: which bloom storyboard frame shared energy maps to */
  bloom: ResolvedStoryboardFrame | null;
};
```

Bloom mapping: reuse `resolveStoryboardFrame({ worldStoryboard: brand.bloomStoryboard, ... }, state.energy)` — **shared energy**, not personal journey progress.

### 8.2 `GET /api/events/[id]/garden-snapshot`

Convenience: resolve event → chapter → garden → same payload. Lets `WorldJourney` stay on `/e/[slug]` with one fetch.

### 8.3 Internal: `applyGardenMutation` (lib, not public)

Called from contribution APIs. Not a public POST from the browser (prevents forged growth). Optional admin `POST /api/gardens/[id]/mutate` for manual landmark unlock / repair later.

### 8.4 Admin CRUD (Phase A minimal)

- `POST /api/gardens` — create garden + brand kit
- `PATCH /api/gardens/[id]`
- `POST /api/gardens/[id]/chapters` — attach event id + index
- List/detail under `/admin/gardens` (thin UI OK)

### 8.5 Caching

- Snapshot GET: short CDN/browser cache (`max-age=5` or `CDN-Cache-Control` 5–10s) + `ETag: worldVersion`.
- After mutation: bump version; clients poll snapshot every 20–30s (align with presence) or refetch on local submit.

---

## 9. Schema (Supabase, additive)

File: `supabase/song-garden-persistent-world.sql` (new).

```sql
-- gardens
create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind text not null default 'series',
  status text not null default 'draft',
  brand_kit jsonb not null default '{}'::jsonb,
  world_state jsonb not null default '{}'::jsonb,
  world_version int not null default 0,
  mutation_policy jsonb not null default '{}'::jsonb,
  commerce jsonb default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garden_chapters (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  event_id text not null unique, -- one event → one chapter
  idx int not null,
  label text not null default '',
  opens_at timestamptz,
  closes_at timestamptz,
  chapter_weight double precision not null default 1,
  status text not null default 'upcoming',
  unique (garden_id, idx)
);

create table if not exists public.garden_mutations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  chapter_id uuid references public.garden_chapters(id) on delete set null,
  device_id text,
  kind text not null,
  source_type text not null,
  source_id text not null,
  delta jsonb not null default '{}'::jsonb,
  effects jsonb not null default '[]'::jsonb,
  world_version int not null,
  created_at timestamptz not null default now()
);

create index if not exists garden_mutations_garden_created_idx
  on public.garden_mutations (garden_id, created_at desc);

create table if not exists public.garden_participant_marks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  device_id text not null,
  kind text not null,
  idx int not null,
  source_type text not null,
  source_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists garden_marks_garden_device_idx
  on public.garden_participant_marks (garden_id, device_id);

-- Optional pinned editions for commerce
create table if not exists public.garden_editions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  slug text not null,
  label text not null,              -- "March 2026"
  pinned_snapshot jsonb not null,   -- full GardenSnapshot.state + brand subset
  render_seed text not null,
  pinned_at timestamptz not null default now(),
  unique (garden_id, slug)
);

-- RLS: match house style — deny direct PostgREST; service role only
```

Local JSON-store mirrors under `USE_LOCAL_EVENTS` for dev parity (same pattern as songgarden clips).

---

## 10. Commerce hooks (spec only; implement Phase C)

World snapshot is the merch contract.

### 10.1 Monthly edition hoodie

1. Cron or admin action: `POST /api/gardens/[id]/editions` pins `GardenSnapshot` → `garden_editions`.
2. Storefront SKU stores `edition_id`.
3. Print pipeline reads `pinned_snapshot` + `render_seed` → static art (palette from brand + layer intensities + landmark set + version).

### 10.2 Living / on-demand one-of-one

1. Checkout calls `GET .../snapshot` at purchase time (no pin).
2. Order line stores `{ gardenId, worldVersion, renderSeed, deviceId?, markIds? }`.
3. Renderer mixes **garden state** + **buyer’s marks** → unique file.
4. If world_version changes before print, art follows the ordered version (must persist ordered snapshot blob on the order).

### 10.3 Render contract (shared)

```ts
type MerchRenderInput = {
  brand: Pick<BrandKit, "primaryColor" | "accentColor" | "logoUrl" | "title">;
  state: Pick<WorldState, "energy" | "layers" | "landmarks" | "totals" | "renderSeed">;
  personal?: { kinds: ContributionKind[]; count: number };
  format: "hoodie_front" | "hoodie_allover" | "square_print";
};
```

Renderer can start deterministic/canvas (no ML). AI optional later; seed must remain stable.

---

## 11. Crowdsource Fans extension points

Do **not** build Fans in Phase A; reserve shape in BrandKit / WorldState:

```ts
type ZoneDef = {
  key: string;
  label: string;
  sponsorKey?: string;
  /** 0..1 position on schematic map */
  x: number;
  y: number;
};

// Future WorldState addition:
// zones: Record<string, { energy: number; contributions: number }>
```

Mutation intents later accept `zoneKey`. Gameday deliverables read the same snapshot + curated contribution IDs. Choir gardens simply omit `zones`.

---

## 12. Client integration (WorldJourney)

### Phase A behavior when event has a garden

1. On mount: `GET /api/events/[id]/garden-snapshot?deviceId=...`
2. `WorldStage` shared bloom from `snapshot.bloom` / `state.energy` (not personal step %).
3. Personal journey progress still gates moments / completion CTA.
4. Growth layer: render `state.field.nodes` (dim) + `myMarks` (bright).
5. On contribution success: API returns `effects`; client celebration + optimistic mark; refetch snapshot.
6. Poll snapshot ~25s (with presence).

### Phase A when no garden

Unchanged V2 (localStorage growth, personal energy storyboard).

---

## 13. Implementation phases

### Phase A — Persistent core (implement first)

**Deliverables**

- SQL + local store for gardens, chapters, mutations, marks  
- `applyGardenMutation` + wire into clip/turn success paths  
- Snapshot GET (garden + event convenience)  
- Minimal `/admin/gardens` create/attach chapter  
- `WorldJourney` dual-mode render (shared field + personal marks)  
- Effect line in celebration (landmark / layer)

**Acceptance**

- Two browsers, same chapter event: A contributes → B sees energy/nodes change within one poll interval without refreshing the journey step.  
- Event without garden: zero regression.  
- `world_version` increments exactly once per accepted mutation.

### Phase B — Series life

- [x] Between-chapter contribution windows (`live` garden + `/g/[slug]` pulses)
- [x] Chapter finale weight + auto landmark (`POST .../chapters/[id]/finalize`)
- [x] Historical snapshot `at=` / `version=` via mutation log replay
- [x] Admin world debugger (state JSON + recent mutations + historical preview)

### Phase C — Commerce contract

- [x] `garden_editions` pin flow (`POST /api/gardens/[id]/editions`)
- [x] `MerchRenderInput` → PNG preview (`GET /api/gardens/[id]/merch/preview`)
- [x] Stub checkout storing ordered snapshot blob (`POST /api/gardens/[id]/orders`)
- [ ] (External) Printful/Shopify mapping later

### Phase D — Fans skin

- [x] Zones on BrandKit (`zones` / `sponsors`) + zone-scoped mutations (`zone_up`, `WorldState.zones`)
- [x] Public `/g/[slug]` participation map + pulse `zoneKey`
- [x] Sponsor keys on zones + gameday ready shelf (`garden_ready_shelf`, admin + APIs)
- [x] Testing guide: [`TESTING.md`](./TESTING.md)

---

## 14. File / module map (proposed)

| Module | Path |
|---|---|
| Types + defaults | `lib/song-garden-v2/garden/types.ts` |
| Mutation engine | `lib/song-garden-v2/garden/apply-mutation.ts` |
| Snapshot builder | `lib/song-garden-v2/garden/snapshot.ts` |
| Merch render | `lib/song-garden-v2/garden/merch-render.ts` |
| Server repos | `lib/song-garden-v2/garden/store.ts` |
| Local store | `lib/song-garden-v2/garden/local-garden-store.ts` |
| API | `app/api/gardens/**`, `app/api/events/[id]/garden-snapshot/route.ts` |
| Admin UI | `app/admin/gardens/**` |
| Public garden | `app/g/[slug]/**` |
| Client hook | `lib/song-garden-v2/garden/use-garden-snapshot.ts` |
| SQL | `supabase/song-garden-persistent-world.sql`, `supabase/song-garden-commerce-orders.sql`, `supabase/song-garden-ready-shelf.sql` |
| Smoke tests | `scripts/test-garden-phase-{a,b,c,d}.mjs` |
| Testing guide | `docs/song-garden-v2/TESTING.md` |
| This spec | `docs/song-garden-v2/persistent-world-spec.md` |

Keep sales platform untouched.

---

## 15. Risks & decisions

| Topic | Decision |
|---|---|
| Source of truth | Server `world_state`; client optimistic UI only |
| Personal vs shared energy | Split: journey % personal; bloom from garden energy |
| Node cardinality | Cap + compact; never unbounded clip→node |
| Identity | Device id v0; accounts optional later for merch reclaim |
| Realtime | Poll v0; SSE if poll feels dead in packed rooms |
| Moderation | Hide media ≠ auto-revert energy (v0); optional compensating mutation later |
| Multi-garden events | Forbidden (unique `event_id` on chapters) |

**Open product choices (resolve before Phase A build):**

1. Public garden URL `/g/[slug]` in Phase A, or event-only entry until Phase B?  
   - **Recommendation:** event-only entry in A; add `/g/[slug]` in B for between-show life.
2. Should between-show contributions be allowed without an open chapter?  
   - **Recommendation:** yes via `kind=evergreen` window on garden status `live`.
3. Landmark copy tone — mystical vs plain?  
   - **Recommendation:** plain-poetry, no gamification (“A new grove opened”), consistent with no-XP rule in V2 architecture.

---

## 16. Traceability to V2 architecture

| V2 piece | Persistent world |
|---|---|
| `WorldStage` never unmounts | Remains; data source becomes snapshot |
| `useCelebration` | Remains; gains optional `effects` line |
| `growth-nodes.ts` localStorage | Fallback when no garden; else server marks |
| `WorldConfig` / storyboard | BrandKit + shared bloom mapping |
| Presence ticker | Complements snapshot; not replaced |
| Contribution APIs | Gain mutation side effect when chapter-linked |

---

## 17. Definition of done (Phase A)

- [x] Spec reviewed / open choices locked (recommendations in §15)
- [x] Schema applied (prod SQL editor script + local `.data/local-gardens.json` store)
- [x] Mutation + snapshot APIs live
- [ ] One real multi-show garden (2+ chapters) demoable in a live environment
- [x] Merch render contract documented (this §10) without storefront
- [x] Architecture.md links here under “Next”

---

## Appendix A — Example mutation

Input: clap pad clip on Show 2 (`chapter_weight: 1`).

```json
{
  "kind": "percussion",
  "effects": [
    { "type": "layer_up", "kind": "percussion", "level": 0.24 },
    { "type": "energy_up", "delta": 0.012 }
  ],
  "worldVersion": 391
}
```

At energy ≥ 0.4, policy unlocks `{ key: "north_grove", label: "North Grove" }` → celebration line: “North Grove opened in the garden.”

## Appendix B — Example edition pin

```json
{
  "slug": "2026-03",
  "label": "March 2026",
  "render_seed": "garden_ab12:v391:2026-03",
  "pinned_snapshot": {
    "energy": 0.62,
    "layers": { "percussion": 0.71, "vocal": 0.44, "voice": 0.28, "text": 0.33, "video": 0.12, "other": 0.05 },
    "landmarks": [{ "key": "north_grove", "label": "North Grove" }],
    "totals": { "contributions": 1840, "participants": 612 }
  }
}
```
