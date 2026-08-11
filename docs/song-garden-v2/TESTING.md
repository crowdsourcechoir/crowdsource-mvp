# Song Garden Persistent World — Testing Guide (Phases A–D)

Use this when you can run the app locally or against a staging deploy. It covers setup, automated smokes, and manual checks for the shared garden through Crowdsource Fans.

**Spec:** [`persistent-world-spec.md`](./persistent-world-spec.md)

---

## 0. Quick paths

| Mode | When to use |
|---|---|
| **Local JSON store** | Fastest — no Supabase. Set `USE_LOCAL_EVENTS=true` (same flag as local events). Data lives in `.data/local-gardens.json`. |
| **Supabase** | Staging/prod. Run the SQL scripts below once, then use service-role env vars already used by the app. |

Automated smokes (no browser):

```bash
npx tsx scripts/test-garden-phase-a.mjs
npx tsx scripts/test-garden-phase-b.mjs
npx tsx scripts/test-garden-phase-c.mjs
npx tsx scripts/test-garden-phase-d.mjs
npx tsx scripts/test-garden-map-plate-m1.mjs
```

Typecheck:

```bash
npx tsc --noEmit
```

---

## 1. Database setup (Supabase only)

Run in the Supabase SQL Editor **in order**. All scripts are idempotent (`create table if not exists`).

1. **`supabase/song-garden-persistent-world.sql`** — gardens, chapters, mutations, marks, editions, ready shelf (full Phase A–D schema when applied fresh).
2. **`supabase/song-garden-commerce-orders.sql`** — only if your DB already had an earlier Phase A/B apply **without** orders. Fresh installs that ran the full persistent-world script may already have editions; this adds `garden_orders` if missing.
3. **`supabase/song-garden-ready-shelf.sql`** — only if your DB already had Phase A–C and needs the additive ready-shelf table. Fresh installs that ran the updated `song-garden-persistent-world.sql` already include it.

Confirm tables exist: `gardens`, `garden_chapters`, `garden_mutations`, `garden_participant_marks`, `garden_editions`, `garden_orders`, `garden_ready_shelf`.

---

## 2. App env

Minimum for local store:

```bash
USE_LOCAL_EVENTS=true
```

For Supabase (in addition to existing Next/Supabase admin keys):

- Service role must be able to read/write the garden tables (RLS is enabled with **no anon policies** — routes use the admin client).

Start the app as you usually do (`npm run dev` / deploy preview).

---

## 3. Phase A — Persistent core

### Automated

```bash
npx tsx scripts/test-garden-phase-a.mjs
```

Expect: garden create → chapter → mutation → world version bump → marks.

### Manual

1. Open **`/admin/gardens`** → create a garden (slug + title), status **live**.
2. Open the garden detail → **Attach chapter** to an existing event (show index + label).
3. Open the event **`/e/[event-slug]`** in **two browsers** (or normal + private).
4. Complete a contribution (clip / interview turn) in browser A.
5. Within ~one poll interval, browser B should show shared energy / growth without a full page reload.
6. Confirm admin debugger shows `world_version` incremented and a recent mutation.
7. Control: an event **not** attached to any chapter behaves as before (no garden regression).

**APIs to poke (optional):**

- `GET /api/gardens/[idOrSlug]/snapshot`
- `GET /api/events/[eventId]/garden-snapshot`

---

## 4. Phase B — Series life

### Automated

```bash
npx tsx scripts/test-garden-phase-b.mjs
```

Expect: finale bloom + landmark, between-show pulse, historical replay.

### Manual

1. With a **live** garden and at least one chapter, open public **`/g/[garden-slug]`**.
2. **Leave a mark** (between-show pulse). Energy / version should rise; celebration line may appear.
3. In admin, on an open chapter → **Seal finale**. Chapter becomes `closed`; world gains a chapter bloom / landmark.
4. Admin **World debugger**:
   - Inspect `world_state` JSON + recent mutations.
   - Set a datetime → **Preview historical state** (`?at=` replay).
5. Also try snapshot query params:
   - `GET /api/gardens/[id]/snapshot?at=<ISO>`
   - `GET /api/gardens/[id]/snapshot?version=<n>`

---

## 5. Phase C — Commerce

### Automated

```bash
npx tsx scripts/test-garden-phase-c.mjs
```

Expect: pin edition, deterministic merch nodes, stub living + edition orders.

### Manual

1. Admin garden → **Commerce**:
   - **Pin edition** (slug e.g. `2026-08`, label e.g. `August 2026`).
   - Open **Preview PNG** on the edition row.
   - **Living preview** link (current world).
   - **Order living one-of-one** and **Order pinned edition** (stub checkout).
2. Confirm orders list shows `stub` status and frozen world version.
3. Optional API:
   - `GET /api/gardens/[id]/merch/preview?format=square_print&living=1`
   - `GET /api/gardens/[id]/merch/preview?format=hoodie_front&edition=2026-08`
   - `GET /api/gardens/[id]/editions`
   - `GET /api/gardens/[id]/orders`

Printful/Shopify fulfillment is **out of scope** (stub only).

---

## 6. Phase D — Crowdsource Fans skin

### Automated

```bash
npx tsx scripts/test-garden-phase-d.mjs
```

Expect: zone key normalization, `zone_up` effect, snapshot zones + sponsor, ready shelf create/update, replay keeps `zoneKey`.

### Manual — Fans map

1. Admin garden → **Fan map**.
2. **Add a zone**: name e.g. `North End`, optional hint, map spot (top left / bottom right / …) → **Add zone**. Repeat for `South End`.
3. Optional: **Add sponsor** (e.g. `Acme Bank`), then assign it on a zone card.
4. Tap **Save map**. Keys are normalized (`North End!` → `north-end`).
5. Tap **Open public garden** (or `/g/[slug]`):
   - Participation map dots appear (not a seat map).
   - Select a zone → **Leave a mark in …**.
   - Zone energy / marks update; celebration may say a zone grew louder.
6. Admin **Zone energy** should list the zone after pulses.
7. Invalid `zoneKey` on pulse → `409` (when zones are authored).
8. Commerce + world debugger live under **Advanced** (collapsed by default).

### Manual — Season map plate (M1–M4)

1. Admin garden → **Fan map** → **Season map plate**.
2. Author zones first (positions matter for M2). Add 1–2 reference photo URLs + vibe.
3. Leave **Layout-guided** on → **Generate draft** (needs `RUNWAYML_API_SECRET`).
4. Preview draft + optional layout schematic in brand kit; confirm zones unchanged.
5. **Pin for season** — live map URL becomes the draft.
6. **Generate ambient loop (M3)** — `/g` plays the loop over the plate; zone glows scale with energy.
7. **Matchday variants (M4)** — Generate Kickoff / Goal / … then set **Active on /g**.
8. Open `/g/[slug]` — still or loop uses the active variant; hit regions still work.
9. Generate another draft without pinning — live plate, ambient, and hits must not change.

**APIs:**

```bash
# Generate layout-guided draft (does not change live heroArtworkUrl)
curl -X POST "$ORIGIN/api/gardens/$ID/map-plate/generate" \
  -H 'Content-Type: application/json' \
  -d '{"vibePrompt":"night matchday navy + chartreuse","referenceUrls":["/fans/ballard-fc/interbay-stadium-map.jpg"],"layoutGuided":true}'

# Pin draft for the season
curl -X POST "$ORIGIN/api/gardens/$ID/map-plate/pin" \
  -H 'Content-Type: application/json' \
  -d '{"confirmReplace":true,"seasonLabel":"2026 season"}'

# Ambient motion loop (M3)
curl -X POST "$ORIGIN/api/gardens/$ID/map-plate/motion" \
  -H 'Content-Type: application/json' -d '{}'

# Matchday variant (M4)
curl -X POST "$ORIGIN/api/gardens/$ID/map-plate/variants" \
  -H 'Content-Type: application/json' \
  -d '{"key":"goal","withMotion":false}'

# Activate variant on /g
curl -X PATCH "$ORIGIN/api/gardens/$ID/map-plate/variants" \
  -H 'Content-Type: application/json' \
  -d '{"activeVariantKey":"goal"}'
```

**Pulse API:**

```bash
curl -X POST "$ORIGIN/api/gardens/$SLUG/pulse" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev_testdevice01","kind":"text","zoneKey":"north-end"}'
```

### Manual — Gameday checklist

1. Admin → **Gameday checklist**:
   - Title + moment (`kickoff` / `goal` / …) + optional zone (dropdown from Fan map).
   - **Add to checklist** or **Add with world snapshot** (embeds world version, energy, zone stats).
2. Tap **Mark played** — row should show a green **Played ✓** badge and a success notice. (Fan public page does not change yet.)
3. APIs:
   - `GET /api/gardens/[id]/ready-shelf`
   - `POST /api/gardens/[id]/ready-shelf` body: `{ "title", "momentType", "zoneKey?", "sponsorKey?", "promote?" }`
   - `PATCH /api/gardens/[id]/ready-shelf/[itemId]` body: `{ "status": "played" }`

---

## 7. Suggested end-to-end demo script (one sitting)

1. Create live garden `demo-fans` (kind `season` if available).
2. Attach 1–2 event chapters.
3. Contribute on `/e/...` (Phase A shared field).
4. Visit `/g/demo-fans`, leave between-show marks (Phase B).
5. Seal one chapter finale (Phase B).
6. Pin edition + open merch preview + stub living order (Phase C).
7. Author zones/sponsors (or run **Create Ballard FC demo**) → zone pulses on `/g` → promote ready-shelf goal moment → mark played (Phase D).
8. Two browsers on `/g` or `/e` to prove shared world version moves for both.

### Ballard FC demo (quick phone test)

1. Admin → Gardens → **Create Ballard FC demo** (or `POST /api/gardens/demos/ballard-fc`).
2. Open **`/g/ballard-fc`** — Interbay stadium map with sponsored zones (seed photo until you generate + pin a season plate).
3. Optional: Admin Fan map → Generate draft → Pin for season (M1).
4. Tap a zone (Supporters, Beer Garden, Pagliacci Pitch, …) → **Leave a mark**.
5. Confirm zone energy rises on the card.

---

## 8. What “good” looks like

| Check | Pass |
|---|---|
| Shared mutations | `world_version` +1 per accepted contribution; second client sees it |
| No garden | Unattached events unchanged |
| Finale | Chapter `closed`; landmark / bloom in state |
| Historical | `?at=` / `?version=` snapshot differs from live when expected |
| Edition | PNG preview opens; stub order freezes snapshot version |
| Zones | Map on `/g`; zone energy rises; invalid zone rejected |
| Map plate (M1–M4) | Layout-guided draft; pin; ambient loop on `/g`; variants switch mood without moving hits |
| Ready shelf | Items list; promote payload has `worldVersion`; played status sticks |

---

## 9. Troubleshooting

| Symptom | Likely fix |
|---|---|
| Gardens empty / 500 on APIs | Local: set `USE_LOCAL_EVENTS=true`. Prod: run SQL + check service role. |
| Ready shelf 500 | Run `song-garden-ready-shelf.sql` (or full persistent-world script). |
| Orders 500 | Run `song-garden-commerce-orders.sql`. |
| Pulse 409 | Garden not `live`, or `zoneKey` not in BrandKit zones. |
| Map empty on `/g` | Zones JSON not saved / empty array on brand kit. |
| Old nodes missing `zoneKey` | Harmless; engine backfills `null` on next mutation. |
| Local data weird | Delete `.data/local-gardens.json` and recreate gardens. |

---

## 10. File cheat sheet

| Area | Path |
|---|---|
| Types / zones / ready item | `lib/song-garden-v2/garden/types.ts` |
| Mutations | `lib/song-garden-v2/garden/apply-mutation.ts` |
| Snapshot + window | `lib/song-garden-v2/garden/snapshot.ts` |
| Store | `lib/song-garden-v2/garden/store.ts` |
| Admin | `app/admin/gardens/**` |
| Public presence | `app/g/[slug]/**` |
| Ready shelf API | `app/api/gardens/[id]/ready-shelf/**` |
| SQL | `supabase/song-garden-*.sql` |
| Smokes | `scripts/test-garden-phase-*.mjs` |
