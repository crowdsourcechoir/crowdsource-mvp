# Gameday scale strategy — 5,000 concurrent participants

Status: **strategy** (prep plan, not implementation)  
Lens: OCTO Core → Garden (upload/community spine), Live (runtime polls), Composer (post-drop load)  
Related: `docs/crowdsource-platform-v2-plan.md`, `docs/song-garden-v2/persistent-world-spec.md`

---

## 0. Scenario

A Bloom / gameday moment: **~5,000 people** scan a QR and try to contribute (video, sound, text) in a short window.

Two different problems get conflated:

| Problem | Feel | Primary bottleneck |
| --- | --- | --- |
| **Faster load times** | “Page feels slow on stadium Wi‑Fi / LTE” | Client JS waterfall, event fetch, fonts/images, no edge cache |
| **More concurrent users** | “Submit fails / spins / garden freezes” | Upload path through Vercel, Postgres media, garden CAS, poll storms |

Prepare for both. Fixing only UX polish will not survive a media stampede.

---

## 1. What the system does today (evidence)

Primary QR path: **`/e/[slug]` → WorldJourney** (Song Garden modality).

| Path | How media moves | Risk at 5k |
| --- | --- | --- |
| Sound clips | Client → `POST /api/songgarden` → **Postgres `bytea`** (hex-encoded) | Critical — serverless holds full file; DB stores blobs |
| Video / interview audio | Client → `POST …/send` as **base64 JSON** → Vercel → Supabase Storage + OpenAI | Critical — ~4.5MB body limit + LLM on submit |
| Text | JSON submit | Medium — cheaper, still hits garden mutation |
| Live prompt (`/live`) | Text only; polls every **2.5s** | Poll storm if used as join URL |
| Garden presence (`/g`) | Pulse JSON; snapshot poll **~25s** | Manageable reads if cached |

Admin already has the right pattern: **signed direct-to-storage upload** (`/api/events/hero-upload/prepare`, logos, storyboard refs) specifically to bypass Vercel body limits. **Participants do not use it yet.**

Garden shared state uses **optimistic `world_version` CAS** with one retry (`recordGardenContribution`). Under stampede, many contributions will land as clips/turns while **shared world effects drop**.

Soft rate limit: ~1–2s device cooldown — stops double-taps, not stadium scale.

---

## 2. Rough capacity math (order-of-magnitude)

Assume 5,000 scans in ~3 minutes after a call-to-action; **30% upload media** in a 5-minute window → ~1,500 uploads → **~5/s average**, **50–100/s peak** bursts.

If each video is ~1.5MB binary (~2MB as base64) through Vercel:

- Peak ingress through functions: tens of MB/s
- Each function holds encode + DB/Storage write in memory
- Plus OpenAI on the interview send path (30s `maxDuration`)

**Verdict:** current architecture is fine for dozens–low hundreds of overlapping uploads. It is **not ready for a 5k media drop** without changing the upload and aggregation shape.

Text-only or heavily staggered contributions are a different (easier) problem.

---

## 3. Failure modes under a 5k stampede

1. **Submit failures / timeouts** — Vercel concurrency, body limit, function memory, 30s AI path  
2. **DB saturation** — large `bytea` inserts + clip audio proxy reads during Composer playback  
3. **Lost collective effect** — garden `world_version` CAS conflicts → world feels “dead” while people still uploaded  
4. **Poll storm** — 5k × snapshot/activity every 25s ≈ hundreds of RPS reads; `/live` at 2.5s is worse  
5. **Abandon before contribute** — slow `/e` hydrate + event fetch on bad cellular → never reach record UI  
6. **Post-game Composer freeze** — listing/playing thousands of DB-hosted clips

---

## 4. Preparation strategy (phased)

### P0 — Must have before marketing a 5k media QR

**Goal:** Surviving the drop (uploads ACK; no data-plane collapse).

| Work | Why | Owner |
| --- | --- | --- |
| **Direct-to-storage for participant media** | Reuse admin signed-upload pattern for sound + video; Vercel only mints URL + records metadata | Garden |
| **Stop Postgres `bytea` for new clips** | Object storage + CDN URL; DB holds pointers only | Garden |
| **Kill base64 video on submit** | Binary PUT to signed URL; JSON metadata only | Garden |
| **Decouple submit ACK from OpenAI** | Persist contribution first; AI/transcription async (`waitUntil` / queue) — already partial for Whisper; extend to full send path | Garden + Composer seam |
| **Append-only garden mutations + async reducer** | Drop synchronous CAS on hot path; shared world catches up seconds later | Garden |
| **Hard rate limits + queue UX** | Per-device/IP caps; client “you’re in line” if overloaded; never silent fail | Garden |
| **Gameday load profile** | Synthetic 500→2k→5k concurrent upload test against staging | Garden + Core |

**Success:** 5k clients can complete record→upload→“received” under cellular conditions; &lt;1% hard failures; garden eventually consistent.

### P1 — Faster first paint & join (same weekend or next)

**Goal:** More of the 5k actually reach the contribute UI.

| Work | Why |
| --- | --- |
| **Edge-cache event/world config** | QR stampede is mostly identical GETs; short TTL CDN/ISR for public config |
| **Split WorldJourney bundle** | Dynamic-import pads / framer / Turnstile; loading shell stays tiny |
| **Prefetch mic after first interaction** | Overlap permission with instruction copy |
| **Gameday “lite” journey mode** | Optional Bloom flag: fewer steps, one media type, no heavy celebration stack |
| **Dedicated contribute deep-link** | QR → `/e/[slug]/contribute?step=video` skips discovery chrome |

### P2 — Read path & Amplify (Learfield / social)

| Work | Why |
| --- | --- |
| **CDN for media URLs** | Playback and social packs must not re-hit app→DB |
| **Cached snapshot/activity** | Edge cache 5–15s; or SSE later per persistent-world spec |
| **Participation Index counters** | Increment on ACK (Platform V2 metrics) without scanning tables |
| **Composer ingest from Storage** | Don’t stream thousands of bytea rows into admin |

### P3 — Operational readiness

| Work | Why |
| --- | --- |
| **Gameday runbook** | Which QR, which modality, expected RPS, kill switches (pause uploads, text-only fallback) |
| **Observability** | Submit success rate, p95 upload time, function concurrency, Storage errors, CAS drop rate |
| **Capacity ceilings published** | “This Bloom supports N concurrent media uploads” — honest Sales/Learfield language |
| **Stagger dramaturgy (Roots)** | Don’t ask 5k to upload the same 30s; wave by section / Hype Team / time boxes |

Dramaturgy is capacity engineering. Roots should design participation thresholds so infrastructure and show craft move together.

---

## 5. What *not* to do first

- Vertical-scale Postgres and hope bytea works  
- Put OpenAI on the critical path for live ACK  
- Use `/live` (2.5s polling) as the primary 5k join URL without a cache redesign  
- Build a separate “stadium app” that forks identity/contribution from Garden  
- Promise Learfield 5k video drops before P0 is proven in load test

---

## 6. Recommended near-term product posture

Until P0 is proven:

| Safe to sell / run | Risky |
| --- | --- |
| Text + short audio with staggered waves (hundreds overlapping) | “Everyone film a 20s video now” to 5k at once |
| Pre-game SOURCE over days + gameday ACTIVATE of selected material | Cold QR → heavy WorldJourney → multi-step media on stadium Wi‑Fi |
| Capture of crowd performing a chant (one-to-many) | Many-to-one raw video ingest without Storage direct upload |

This still deepens participation: SOURCE earlier, ACTIVATE together, AMPLIFY after — without melting the pipe.

---

## 7. Alignment with Platform V2

Platform V2 (community spine) and gameday scale share the same foundation:

- Contribution graph with **Storage URLs + rights**, not blobs in Postgres  
- Identity modes that don’t block open gameday (anonymous-first)  
- Index metrics incremented at **ACK time**  
- Recognition packs generated from metadata, not by re-downloading bytea through Vercel

Build scale P0 as part of (or immediately after) the Garden Platform V2 spine — do not treat them as separate products.

---

## 8. Suggested build order (Garden Agent)

1. Participant **signed upload prepare + confirm** API (mirror hero-upload)  
2. Migrate `SoundMomentPad` / `VideoMomentPad` off proxy/base64  
3. Clip rows → Storage URL columns; stop new `bytea` writes  
4. Submit returns 202/200 after metadata persist; AI async  
5. Garden mutation queue / async apply  
6. Load test harness + gameday lite flag  
7. Edge-cache snapshot + bundle split  

Roots: design wave/stagger rituals for 5k.  
Sales: capacity language for Learfield until load tests pass.  
Live: do not point stadium QR at high-frequency poll surfaces without P2.

---

## 9. One-line Core verdict

**5,000 scanners is a join problem; 5,000 media uploads is a storage-and-aggregation problem.** Today we are built for the first at modest scale and for the second only at pilot scale. Prepare by making participant media behave like admin media (direct-to-Storage), making the garden eventually consistent under stampede, and using dramaturgy to shape load — then prove it with a load test before the QR promises 5k videos.
