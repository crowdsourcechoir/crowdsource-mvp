# Conference readiness — 7-day window

Status: in progress  
Conference: ~7 days out · journey **text-first** · optional sound steps possible

## Already live (main)

- SSR/ISR `/e/[slug]`, edge cache on reads, journey text submits skip OpenAI
- See prior perf PR

## Day 0–1 (Joel — required once)

Run in **Supabase SQL Editor** (production):

```sql
-- supabase/songgarden-storage-paths.sql
```

Without this, sound uploads fall back to legacy multipart (through Vercel).

## Day 1–2 — Direct-to-storage (live on main)

**Sound (Song Garden pads):**
- `POST /api/songgarden/upload/prepare` → signed URL → PUT → confirm
- Requires `supabase/songgarden-storage-paths.sql`

**Video (journey VideoMomentPad):**
- `POST /api/agent/conversations/[id]/media/prepare` → signed URL → PUT
- Send turn with `videoStoragePath` + `videoPublicUrl` (no base64 through Vercel)

**Audio pads** use the songgarden clip path above. Interview audio via agent send supports the same direct pattern when used.

## Day 3–4 — Prove

- Load test: 200 concurrent page loads + 50 text submits + 20 sound uploads + 10 video uploads

## Day 5 — Conference lock

- Final journey config (text-first, sound optional)
- Stagger email if possible (AM/PM cohorts)
- Spot-check one phone on LTE

## Day 6–7 — Buffer

- Monitor submit success rate day-of inbox send
- Runbook: pause heavy steps in admin if needed

## Not required for text-only conference

Legacy bytea clip backfill can wait until after if you never play old clips from DB.
