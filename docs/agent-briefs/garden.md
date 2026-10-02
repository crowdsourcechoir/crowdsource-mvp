# GARDEN Agent — persistent participatory worlds

| | |
|---|---|
| **Admin home** | `/admin/gardens` |
| **Public surface** | `/g/[slug]` |
| **Code prefixes** | `app/admin/gardens`, `app/api/gardens`, `lib/song-garden-v2/garden`, `lib/songgarden`, `components/song-garden-v2` |
| **Primary tables** | `gardens`, `garden_chapters`, `garden_mutations`, `garden_participant_marks`, `garden_editions`, `garden_orders`, `garden_ready_shelf`, `songgarden_clips`, `event_memory_records` |
| **Reference docs** | `docs/song-garden-v2/persistent-world-spec.md`, `docs/song-garden-v2/architecture.md`, `docs/song-garden-v2/TESTING.md` |

## 1. Mission

A Garden is the world that persists. It exists before a Bloom, grows during one, and remains
after everyone goes home — holding contributions, presence, chapters, media, and an evolving
identity. This agent owns that persistence layer: the garden data model, the public presence
map at `/g/[slug]`, the clip library, the season map plate, and the memory archive.

The distinction that matters: a Bloom is a moment, a Garden is the accumulation of moments.

## 2. Scope

### Owns

- Garden CRUD and admin: `app/admin/gardens/**`
- Public garden presence: `app/g/[slug]/**`
- Garden data model and mutation math: `lib/song-garden-v2/garden/**`
- Snapshots, energy, participant marks, chapters
- Season map plate pipeline (M1 through M4)
- Song Garden clip capture and storage: `lib/songgarden/**`, `app/api/songgarden/**`
- Editions, stub orders, ready shelf
- Memory layer: `lib/memory/**`, `app/api/memory/**`

### Does not own

| Belongs to | When it comes up |
|---|---|
| BLOOM | The `events` row itself, `EventForm`, `/e/[slug]`, the participant journey |
| COMPOSER | Arranging clips into music; the Composer canvas and library UI |
| OCTO | Admin chrome, design tokens, Settings, auth |
| LIVE | Anything happening in the room in real time |

The seam with BLOOM is `garden_chapters`. Garden owns the chapter and everything it
accumulates; Bloom owns the event row the chapter points at.

## 3. Start a new GARDEN agent

```text
You are the GARDEN agent for Crowdsource Choir. You own persistent participatory worlds:
the garden data model, the public presence map at /g/[slug], chapters, snapshots and energy,
the clip library, the season map plate, and the memory archive.

Read these first:
- docs/agent-briefs/garden.md — your brief, including open threads
- docs/song-garden-v2/persistent-world-spec.md — the phased spec you are implementing
- docs/song-garden-v2/TESTING.md — how to verify garden work
- docs/octo-living-system-workspace.md — living-system vocabulary

Gardens persist; Blooms activate. The `events` table is BLOOM's; you reach it through
garden_chapters. Admin chrome and design tokens are OCTO's.

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### Routes

| URL | File | Purpose |
|---|---|---|
| `/admin/gardens` | `app/admin/gardens/page.tsx` | Garden list |
| `/admin/gardens/new` | `app/admin/gardens/new/page.tsx` | Create a garden |
| `/admin/gardens/[id]` | `app/admin/gardens/[id]/GardenDetailClient.tsx` | Detail: brand kit, zones, chapters, composition |
| `/admin/gardens/[id]/blooms/new` | `app/admin/gardens/[id]/blooms/new/page.tsx` | Garden-first Bloom create (shared with BLOOM) |
| `/admin/songgarden/[eventId]` | `app/admin/songgarden/[eventId]/page.tsx` | Bloom-scoped clip canvas |
| `/g/[slug]` | `app/g/[slug]/GardenPresenceClient.tsx` | Public presence map, pulses, zone journeys |

### API

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/gardens` | GET, POST | List and create |
| `/api/gardens/[id]` | GET, PATCH, DELETE | Detail with chapters; update; delete |
| `/api/gardens/by-event` | GET | Resolve garden and chapter from an `eventId` |
| `/api/gardens/[id]/chapters` | GET, POST | List and attach chapters |
| `/api/gardens/[id]/chapters/[chapterId]/finalize` | POST | Seal a chapter finale |
| `/api/gardens/[id]/snapshot` | GET | Canonical world snapshot; supports `?at=`, `?version=`, `?deviceId=` |
| `/api/gardens/[id]/pulse` | POST | Leave a mark, optionally in a zone |
| `/api/gardens/[id]/composition` | GET | Clips and zone marks across chapters |
| `/api/gardens/[id]/editions` | GET, POST | Merch editions |
| `/api/gardens/[id]/orders` | GET, POST | Stub checkout only |
| `/api/gardens/[id]/merch/preview` | GET | Deterministic PNG via `next/og` |
| `/api/gardens/[id]/ready-shelf` | GET, POST | Gameday ready shelf |
| `/api/gardens/[id]/map-plate/*` | POST, PATCH | Map plate M1 generate, pin, motion, variants |
| `/api/gardens/[id]/debug` | GET | Live state and recent mutations |
| `/api/songgarden` | GET, POST | Clip list and legacy upload |
| `/api/songgarden/upload/prepare` | POST | Signed Storage upload URL |
| `/api/songgarden/upload/confirm` | POST | Persist clip metadata after direct PUT |
| `/api/songgarden/[clipId]/audio` | GET | Stream clip audio |
| `/api/memory/finalize` | POST | Assemble and persist an Event Memory Record |

### Libraries and components

| File | Purpose |
|---|---|
| `lib/song-garden-v2/garden/store.ts` | Supabase and local garden CRUD, mutations, snapshots, orders |
| `lib/song-garden-v2/garden/apply-mutation.ts` | Pure mutation math, finale, historical replay |
| `lib/song-garden-v2/garden/snapshot.ts` | Builds the renderable snapshot |
| `lib/song-garden-v2/garden/map-plate.ts` | Season map plate pipeline |
| `lib/song-garden-v2/garden/types.ts` | Garden, brand kit, zones, map plate, commerce types |
| `lib/song-garden-v2/garden/use-garden-snapshot.ts` | Client poll; a 404 means unlinked, fall back to local growth |
| `lib/song-garden-v2/persist-generated-media.ts` | Re-hosts Runway output before it expires |
| `lib/songgarden/prepare-audio.ts` | Browser decode to WAV plus silence trim |
| `lib/songgarden/storage-upload.ts` | Signed uploads under `clips/` |
| `lib/memory/assemble-record.ts` | Builds the memory payload from contributions |
| `components/song-garden-v2/GardenCompositionCanvas.tsx` | Garden composition UI |
| `components/song-garden-v2/ZoneMapEditor.tsx` | Admin zone pin and hit editor |
| `components/songgarden/SonggardenCanvas.tsx` | Clip canvas, shared with Composer |

### Database

| Table | Defined in | Holds |
|---|---|---|
| `gardens` | `supabase/song-garden-persistent-world.sql` | The world: brand kit, zones, map plate |
| `garden_chapters` | same | The Garden ↔ Bloom link (`garden_id`, `event_id`) |
| `garden_mutations` | same | Every contribution's effect on the world |
| `garden_participant_marks` | same | Per-device presence marks |
| `garden_editions` | same | Pinned merch editions |
| `garden_orders` | same, plus `supabase/song-garden-commerce-orders.sql` | Stub orders |
| `garden_ready_shelf` | same, plus `supabase/song-garden-ready-shelf.sql` | Gameday shelf items |
| `songgarden_clips` | `supabase/songgarden-tables.sql` | Audio clips; altered by the spam, trim, and storage-path migrations |
| `event_memory_records` | `supabase/memory-layer-tables.sql` | Consent-tiered memory archive |

### Environment

| Variable | Required? | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Database and Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | All access; RLS blocks anon |
| `SONG_GARDEN_MEDIA_BUCKET` | no, defaults to `song-garden-world-media` | Clips, storyboards, map plates |
| `SUPABASE_MEDIA_BUCKET` | no, defaults to `agent-media` | Interview voice and video |
| `RUNWAYML_API_SECRET` | for generation | Map plate and storyboard |
| `USE_LOCAL_EVENTS` | dev only | Local JSON gardens in `.data/local-gardens.json` |

### Verification

No npm wrappers; run directly. `docs/song-garden-v2/TESTING.md` is the full guide.

```bash
npx tsx scripts/test-garden-phase-a.mjs   # create, chapter, mutation, marks
npx tsx scripts/test-garden-phase-b.mjs   # finale, pulse, historical replay
npx tsx scripts/test-garden-phase-c.mjs   # editions, stub orders, merch
npx tsx scripts/test-garden-phase-d.mjs   # zones, ready shelf
npx tsx scripts/test-garden-map-plate-m1.mjs
node scripts/test-garden-mutation.mjs
npx tsx scripts/test-silence-trim.mjs
```

## 5. State of play

### Alive now

- Garden CRUD, garden-first Bloom create, chapter linking
- Contribution to mutation pipeline covering clips, interview turns, and pulses
- Snapshots including historical replay by `?at=` or `?version=`
- Public `/g/[slug]` presence map with pulses and zone journeys into a Bloom
- Season map plate M1 through M4
- Ready shelf and the Fans composition feed
- Clip pipeline with Storage uploads, silence trim, and originals kept for restore
- Memory finalize and list

### Growing now

- **Commerce is stubs.** `createStubOrder` writes `status: "stub"`. Printful and Shopify are
  deliberately deferred per the spec
- Ready shelf "mark played" does not change the public `/g` view yet
- No websockets anywhere; `/g` and presence poll at roughly 25 seconds
- `aiArtworkPrompt` in `world-config.ts` is reserved and unused

### Growing into

- Real fulfillment for editions (orders freeze the print contract today as stubs)
- Per-garden auth and visibility controls

## 6. Rules and gotchas

1. **Garden is not Bloom.** The link is `garden_chapters`, not a `garden_id` column on
   `events`. A Bloom can exist with no garden; a Garden can host many Blooms over seasons.
2. **Unlinked events stay local.** With no chapter, `useGardenSnapshot` gets a 404 and the
   participant sees `localStorage` growth and personal energy instead of shared world energy.
   This is intended, not a bug.
3. **RLS is on with no anon policies.** Every garden table is service-role only. All access
   goes through route handlers.
4. **Two buckets, do not mix them.** Clips, storyboards, and map plates go to
   `SONG_GARDEN_MEDIA_BUCKET` under `clips/` and `storyboards/`. Interview audio and video go
   to `SUPABASE_MEDIA_BUCKET` under `conversations/`.
5. **Runway URLs expire.** Always call `persistGeneratedMedia` before writing a generated URL
   into `world_config` or a brand kit.
6. **Generating a map plate is not pinning it.** Generate produces a draft; the live
   `heroArtworkUrl` and zone hits only change on pin.
7. **Zone keys normalize.** "North End!" becomes `north-end`. A pulse with an invalid
   `zoneKey` returns 409 when the garden has zones.
8. **Zone engage modes differ.** `pulse` leaves a mark; `journey` needs a valid
   `journeyEventId` and sends the visitor to `/e/[slug]?fromGarden=…&zone=…`.
9. **Clip routes tolerate missing columns.** The trim and storage-path migrations may not be
   applied in a given environment, so the routes fall back. Prefer applying the SQL over
   leaning on the fallback forever.
10. **Device identity is a `dev_*` id** in `localStorage` under `csc_songgarden_device_id`.
    Anonymous and resettable.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Real fulfillment for editions | Orders are stubs; the print contract is frozen but nothing ships | `lib/song-garden-v2/garden/store.ts`, spec Phase C |
| Ready shelf played state on `/g` | Marking played has no public effect | `app/api/gardens/[id]/ready-shelf/[itemId]/route.ts` |
| Replace polling with realtime | 25 second lag on shared presence | `lib/song-garden-v2/garden/use-garden-snapshot.ts` |
| Enable RLS on `songgarden_clips` | The one garden table missing the posture | `supabase/songgarden-tables.sql`, coordinate with OCTO |
| Retire the V1 participant journey | `ParticipantJourney` and `PublicEventContent.tsx` are dead code on the public path | Coordinate with BLOOM |

## 8. Handoff log

### 2026-09-06 — brief created

- Changed: nothing in the domain; this brief was written from a code survey.
- Learned: commerce is intentionally stubbed, and the unlinked-event local-growth fallback is
  a designed behavior that reads like a bug.
- Watch out: `songgarden_clips` has no RLS.
