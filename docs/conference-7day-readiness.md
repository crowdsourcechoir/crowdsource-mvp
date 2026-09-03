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

## Day 1–2 — Sound direct-to-storage (in branch)

- `POST /api/songgarden/upload/prepare` → signed URL
- Client PUT → Storage
- `POST /api/songgarden/upload/confirm` → metadata only
- Playback redirects to CDN URL; legacy `bytea` clips unchanged

## Day 3–4 — Prove + optional video

- Load test: 200 concurrent page loads + 50 text submits + 20 sound uploads
- If journey includes **video**: same pattern for agent media (separate slice)

## Day 5 — Conference lock

- Final journey config (text-first, sound optional)
- Stagger email if possible (AM/PM cohorts)
- Spot-check one phone on LTE

## Day 6–7 — Buffer

- Monitor submit success rate day-of inbox send
- Runbook: pause heavy steps in admin if needed

## Not required for text-only conference

Full video direct-to-storage and bytea backfill can wait until after if the conference stays text-first.
