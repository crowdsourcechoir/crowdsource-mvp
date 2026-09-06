# COMPOSER Agent — turning participation into music

| | |
|---|---|
| **Admin home** | `/admin/composer` |
| **Public surface** | none |
| **Code prefixes** | `app/admin/composer`, `app/admin/composition`, `app/api/composition`, `lib/composition`, `components/songgarden` |
| **Primary tables** | `song_seeds`, `prompt_game_ai_outputs` (kind `composition_brief`), `songgarden_clips` |
| **Reference docs** | `docs/octo-living-system-workspace.md` (the Composer section defines the vocabulary triad) |

## 1. Mission

Composer is where collected human presence becomes music. Voices, words, sounds, photos and
video come in; songs, chants, anthems and show material go out. It is the workspace where
material is inspected, arranged, curated and formed — not the engine that generates it.

Keep the triad straight, because the workspace doc is explicit about it:

- **Composer** — the domain, the admin home, this agent
- **Composition** — the process and its artifacts: briefs, chant candidates, song seeds
- **canvas** (lowercase) — the spatial arrangement UI inside Composer, not a pillar name

## 2. Scope

### Owns

- The Composer hub and its library scopes: `app/admin/composer/page.tsx`
- The canvas and clip UI: `components/songgarden/SonggardenCanvas.tsx` and its parts
- Composition briefs: `lib/composition/**`, `app/api/composition/brief/route.ts`,
  `app/admin/composition/brief/**`
- Song seeds: `app/api/agent/song-seed/**`, `lib/transcribe-media.ts`, `lib/song-seed-suno.ts`
- Suno prompt text generation
- Audio inspection: waveforms, clip detail, sound pack export

### Does not own

| Belongs to | When it comes up |
|---|---|
| GARDEN | Clip *capture*, storage, and the persistent world; the clip table is Garden's |
| BLOOM | Collecting contributions in the first place; the participant journey |
| LIVE | Prompt game submissions; Composer reads them, Live owns them |
| ROOTS | What makes a good chant or a good hook, methodologically |
| OCTO | Chrome, tokens, Settings |

Composer reads widely and writes narrowly: it consumes contributions from three domains and
produces briefs and seeds.

## 3. Start a new COMPOSER agent

```text
You are the COMPOSER agent for Crowdsource Choir. You own turning participation into music:
the Composer hub and canvas at /admin/composer, composition briefs, song seeds, Suno prompt
text, and audio inspection.

Read these first:
- docs/agent-briefs/composer.md — your brief, including open threads
- docs/octo-living-system-workspace.md — especially the Composer/Composition/canvas triad

Vocabulary is load-bearing here: Composer is the domain, Composition is the process and its
artifacts, canvas is lowercase and is a UI, never a pillar. Clip capture and storage belong
to GARDEN; you consume the library.

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### Routes

| URL | File | Purpose |
|---|---|---|
| `/admin/composer` | `app/admin/composer/page.tsx` | Domain home. Library dropdown across Master, gardens and their blooms, and loose blooms. `?garden=` and `?bloom=` deep-link |
| `/admin/composition/brief` | `app/admin/composition/brief/CompositionBriefView.tsx` | Generate and view a composition brief; copy sections, download Markdown or JSON |
| `/admin/canvas` | `app/admin/canvas/page.tsx` | Legacy redirect to `/admin/composer` |
| `/admin/songgarden/[eventId]` | `app/admin/songgarden/[eventId]/page.tsx` | Bloom-scoped canvas, links back to Composer |

### API

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/composition/brief` | GET, POST | Latest cached brief; generate a new one and persist |
| `/api/admin/composer/library` | GET | Master library: up to 2000 clips plus gardens and events |
| `/api/agent/song-seed` | GET | Latest song seed for an event |
| `/api/agent/song-seed/generate` | POST | Build a transcript, generate a seed, insert it. `maxDuration=300` |
| `/api/transcribe` | POST | Ad-hoc Whisper from a data URL |
| `/api/summarize` | POST | Older lyric-prompt and key-phrase summarizer |
| `/api/songgarden` | GET | Clip list for a bloom |
| `/api/gardens/[id]/composition` | GET | Garden-scoped clips and marks |

### Libraries and components

| File | Purpose |
|---|---|
| `lib/composition/gather-inputs.ts` | Pulls interview lines, live submissions, and Signal winners |
| `lib/composition/build-brief.ts` | One GPT-4o-mini pass to themes, hooks, chants, and Suno prompts |
| `lib/composition/export-formats.ts` | Brief to Markdown or JSON |
| `lib/composition/types.ts` | Gather and brief contracts |
| `lib/transcribe-media.ts` | Whisper plus `buildSongSeedTranscriptText` |
| `lib/song-seed-suno.ts` | Persists Suno prompts with a backup inside `source_mapping` |
| `lib/agent-post-submit-transcribe.ts` | Async post-submit transcription of audio and video turns |
| `lib/songgarden/waveform-peaks.ts` | Peak bars for clip cards |
| `lib/songgarden/clip-fetch-queue.ts` | Caps concurrent audio downloads at four |
| `lib/songgarden/sound-pack.ts` | DAW-friendly zip layout |
| `lib/songgarden/reference-tones.ts` | Choir scale-degree cue tones in `public/tones` |
| `components/songgarden/SonggardenCanvas.tsx` | The canvas across master, garden, and bloom scopes |
| `components/songgarden/ComposerLibraryPicker.tsx` | The library dropdown |
| `components/songgarden/ClipDetailPanel.tsx` | Inspect a clip |
| `components/songgarden/ClipWaveform.tsx` | Waveform with seek |
| `components/songgarden/DraggableAudioClip.tsx` | Drag a clip out to a DAW |

### The two artifacts

They are easy to conflate and they are not the same thing.

| | Song Seed | Composition Brief |
|---|---|---|
| Input | Interview transcripts only | Interview lines, live submissions, Signal winners |
| Transcription | Will call Whisper if a turn has no stored transcript | Never transcribes; uses stored transcripts only |
| Code | `app/api/agent/song-seed/generate/route.ts`, `lib/transcribe-media.ts` | `lib/composition/gather-inputs.ts`, `lib/composition/build-brief.ts` |
| Stored in | `song_seeds` | `prompt_game_ai_outputs` with `kind='composition_brief'` |
| Triggered from | Bloom manage page | `/admin/composition/brief` |

Song Seed output shape:

```ts
{
  topThemes: string[];
  notableLines: string[];
  singableHooks: string[];
  shoutouts: string[];
  emotionalToneSummary: string;
  sourceMapping: Array<{ field: string; participantId?; turnId?; lineIndex? }>;
  sunoPrompts: string[];  // up to 3 paste-ready paragraphs
}
```

If a turn has media but no typed text and Whisper returns nothing, generation fails with a
422 carrying `issues`.

### Database

| Table | Defined in | Holds |
|---|---|---|
| `song_seeds` | `supabase/agent-interview-tables.sql` | Themes, lines, hooks, shoutouts, tone, source mapping |
| `song_seeds.suno_prompts` | `supabase/song-seeds-suno-prompts.sql` | Suno prompt paragraphs |
| `agent_conversation_turns.audio_transcript` / `video_transcript` | `supabase/agent-turn-transcripts.sql` | Cached transcripts |
| `songgarden_clips` | `supabase/songgarden-tables.sql` | The clip library, with trim and storage-path migrations |
| `prompt_game_ai_outputs` | `supabase/prompt-game-tables.sql` | Composition briefs and Song Packs |

### Environment

`OPENAI_API_KEY` for briefs, seeds, and Whisper. `SONG_GARDEN_MEDIA_BUCKET` for clips,
`SUPABASE_MEDIA_BUCKET` for interview media. There is **no Suno API key** — Suno output is
prompt text a human pastes.

### Verification

```bash
npx tsx scripts/test-clip-waveform.mjs
npx tsx scripts/test-clip-fetch-queue.mjs
npx tsx scripts/test-silence-trim.mjs
npx tsx scripts/test-sound-pack-layout.mjs
node scripts/test-songgarden-confirm-trim-fallback.mjs
node scripts/generate-reference-tones.mjs   # regenerates public/tones/*.wav
```

## 5. State of play

### Working

- Composer as the domain home; `/admin/canvas` redirects in
- Master all-sounds library plus garden and bloom scopes, with content views for sounds,
  lyrics, text, video, and all
- Library dropdown replacing the old browse tabs; named titles and deep-link URLs
- Clip waveforms, fetch queue, silence trim with originals kept, direct-to-Storage uploads,
  sound pack zip export
- Song seed generation including Whisper fallback and Suno prompts
- Composition brief generation, caching, and Markdown or JSON export

### Partial or prototype

- The brief and seed pipelines are older and stable but have no evaluation loop — nothing
  checks whether output is good
- No arrangement persistence: the canvas is for inspection and drag-out, not for saving an
  arrangement

### Not built

- Any Suno API integration. Prompts are copy-paste
- Chant candidate curation as a first-class artifact, despite the vocabulary naming it

## 6. Rules and gotchas

1. **The triad is not decoration.** Composer, Composition, canvas each mean something specific.
   Never name a pillar "Canvas".
2. **Bloom is still `events` in code** — `eventId`, `/api/songgarden?eventId=`.
3. **Song seed and composition brief are different artifacts** with different inputs and
   different tables. See the comparison above before touching either.
4. **The brief never transcribes.** If a contribution has no stored transcript it is simply
   absent from the brief. Song seed will transcribe; brief will not.
5. **Suno prompts are dual-persisted** — a column plus a `_sunoPromptsBackup` key inside
   `source_mapping`. Strip the backup when reading through the API.
6. **Audio has two storage paths.** Prefer `audio_storage_path`; bytea is legacy and still
   served when the path is absent. Clips cap around 12MB.
7. **Schema fallbacks are everywhere.** Trim and storage columns may be missing, so routes
   fall back to legacy selects. Apply the SQL rather than relying on this.
8. **Three different library endpoints** by scope: master is `/api/admin/composer/library`,
   bloom is `/api/songgarden`, garden is `/api/gardens/[id]/composition`.
9. **`GardenCompositionCanvas` is not the Composer canvas.** Same clip primitives, different
   shell, and it lives on the garden detail page.
10. **Never invent lyrics.** Both prompts preserve verbatim audience language; that is the
    product's integrity, not a style preference.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Persist arrangements | The canvas cannot save what you arrange | `components/songgarden/SonggardenCanvas.tsx` |
| Make chant candidates a real artifact | The vocabulary promises them; only briefs and seeds exist | `lib/composition/build-brief.ts` |
| Transcribe on demand from the brief screen | Missing transcripts silently shrink a brief | `lib/composition/gather-inputs.ts` |
| Fold Song Seed and Composition Brief together | Two overlapping artifacts confuse the workflow | Compare the two pipelines first |
| Surface Suno prompts where a human actually pastes them | They are buried in seed output | `app/admin/composition/brief/CompositionBriefView.tsx` |

## 8. Handoff log

### 2026-09-06 — brief created

- Changed: nothing in the domain; this brief was written from a code survey.
- Learned: there are two brief-like artifacts with different inputs, storage, and
  transcription behavior. Documented as a comparison table because the difference keeps
  getting lost.
- Watch out: `/admin/canvas` still exists as a redirect; do not treat it as a live page.
