# Platform V2 — WYSIWYG Garden edit (plan)

Status: **plan + first UI cut** (no JSON in Community admin; live edit shell)  
Pilot: Populus / blank Gardens that feel overwhelming today

---

## What those fields meant (plain language)

| Old label | What it actually is | Do you need it? |
|---|---|---|
| **Reachable audience** | “About how many people *could* take part?” (tickets, room size, list size). Used only to turn “12 people joined” into “3% of the room.” | Optional. Skip it until you care about a % for a sponsor. Counts of people / marks / hearts still work without it. |
| **Compute Index** | A **scoreboard for the show** — not code. Three numbers Sales can put in a Learfield conversation. | You want the scoreboard, not a JSON dump. |
| **Credit pack JSON** | The list of **who gets credit** when something is selected / performed / shared — packaged for export. | You want “Share credits,” not raw JSON. |

### The three Index numbers (sponsor-speak)

1. **Who showed up** — contributors ÷ reachable audience (only if you set audience)
2. **How much activity** — contributions + hearts in the campaign window
3. **Who heard it land** — people tied to pieces that were *performed* (Live seam), with a credit path back

---

## North-star UX

**You are looking at the Garden and editing it.**  
The long admin form (Fan map / commerce / debugger) is tooling — not the primary edit surface.

```
/g/[slug]?edit=1     ← primary: WYSIWYG edit the living garden
/admin/gardens/[id]  ← secondary: attach shows, advanced map/commerce, debugger
```

### Primary chrome (live garden)

- Full-bleed garden (map if pinned; otherwise **default center** — same as Song Garden journey / “Plant a seed”)
- **⋮ menu** (top-right): Who can join · Show size · Campaign name · Impact · Share credits · Exit edit
- Tap map to **pin / move zones** (or “Add place”) — no need to scroll a 2000px form
- Culture strip: selected pieces as cards; heart = amplify; long-press/admin = Feature / Performed
- Impact sheet: three big readable stats (never `<pre>` JSON)

### Defaults for a blank Garden

1. No map required → center pulse (“Plant a seed”) works immediately  
2. Identity default: **Open** (anonymous + optional claim)  
3. Audience empty → Impact shows counts, not a fake %  
4. Zones optional → add later by tapping the map in edit mode  

### What stays in `/admin` (advanced)

- Attach Blooms / shows (chapters)  
- Heavy map plate generate / pin / ambient / variants (until moved into edit ⋮ → “Season art…”)  
- Commerce + world debugger (collapsed, never default)

---

## Ideas backlog (not all this cut)

1. **Drag zone pins on the live map** with live hit-preview  
2. **Feature tray** — swipe selected culture onto the garden as floating credits  
3. **One-tap Populus preset** — audience 400, campaign label, pilot flag  
4. **Share credits** → system share sheet / copy nice text / optional image card  
5. **Impact story mode** — “12 of ~400 left a mark · 34 hearts · 1 piece performed”  
6. Collapse Fan map / Composition / Gameday behind “Advanced tools” on admin  
7. Bloom-level identity override (locked decision — later)

---

## This implementation cut

1. Rewrite Community admin panel — **zero JSON**, plain copy, scoreboard cards, “Share credits”  
2. **Edit garden** button → `/g/[slug]?edit=1`  
3. Edit shell on public garden: ⋮ → Who can join / Show size / Impact / Share credits  
4. Document that map pin-on-garden lands next (Composer/Live seams stay API-ready)

## Cut: Plant a seed + atmosphere (shipped)

1. Fan CTA renamed **Plant a seed** (center + zone)  
2. `brandKit.atmosphere` chooser: vibe_video · static_photo · map_plate · gaussian (aurora stub) · brand_wash  
3. `GET/PATCH /api/gardens/[id]/atmosphere`  
4. Live edit ⋮ → **Atmosphere** sheet  

## Cut: Grow Bloom + vibe generate + pin zones + editable copy (shipped)

1. **Grow a Bloom** from a seed → creates event journey + attaches chapter (`POST …/blooms/from-seed`)
2. **In-editor vibe generate** → `POST …/atmosphere/generate` (Runway still + loop)
3. **Tap-to-pin zones** on `/g?edit=1` map → `POST …/zones`
4. **Hover/tap eyebrow + supporting line** to edit (`brandKit.presenceEyebrow` / `presenceMessage`)

Next: evergreen vs time-bound Bloom UI; gaussian env assets; drag-move pins.

---

## Seed → Bloom model (product lock, pending build)

| Concept | Fan-facing | Behavior |
|---|---|---|
| **Plant a seed** | Replaces “Plant a seed” | First living act in the Garden |
| **Seed → Bloom** | “Grow a journey” from a seed | Each seed *can* become a Bloom (same family as today’s Blooms) |
| **Bloom lifetime** | Evergreen or time-bound | Open forever, or closes after an event / window |
| **Bloom stage** | Center or map | **Center:** full-bleed atmosphere + prompts in the middle (current live Bloom / Song Garden). **Map:** prompts unlock and sit on places |

Garden = persistent world. Seed = contribution that can sprout. Bloom = journey grown from a seed (or planned show). Song Garden is a *presentation* of a Bloom, not a separate platform.

### Bloom atmosphere (background) — pluggable, not video-only

Blooms already can generate a **vibe-prompt video loop**. That stays available, but atmosphere is a **chooser**, not a single pipeline:

| Mode | What fans see | Source |
|---|---|---|
| **Vibe video loop** | Moving full-bleed loop (today’s Bloom tool) | Generate from vibe prompt |
| **Static photo** | Still full-bleed image | Upload / library / hero |
| **Map plate** | Season / venue art (± ambient motion) | Garden map pin path |
| **Gaussian / spatial env** | Soft 3D / immersive field (future-friendly) | Separate generator or asset |
| **Solid / gradient** | Minimal brand wash | Brand colors only |

Rules:
- Atmosphere is set **per Bloom** (and Garden can supply a default).
- Center-stage Blooms use atmosphere behind centered prompts.
- Map-stage Blooms use map (or map + overlay atmosphere); prompts live on pins.
- Generating a new vibe loop must **not** wipe an intentionally chosen static photo / gaussian — swap modes explicitly in the ⋮ / stage picker.

UI sketch (edit ⋮ → **Atmosphere**): pick mode → upload or Generate → preview on the live garden before publish.

