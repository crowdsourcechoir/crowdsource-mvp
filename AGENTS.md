# Crowdsource Choir Show Engine

A Next.js 14 application for crowdsourcing audience participation at live events to collaboratively create songs.

## Cursor Cloud specific instructions

### Quick Reference

- **Dev server**: `npm run dev` (runs on port 3000)
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Package manager**: npm (uses `package-lock.json`)

### Local Development Without External Services

Set `USE_LOCAL_EVENTS=true` in `.env.local` to enable in-memory event storage with JSON file persistence (`.data/local-events.json`). This allows full event CRUD without Supabase credentials. Agent interviews and live prompt games still require Supabase.

### Dev Server Notes

- The `npm run dev` script kills any existing process on port 3000 via `lsof`, then starts Next.js. Use a separate tmux session for it.
- Dev output goes to `.next-dev/` (not `.next/`) to avoid corrupting production build artifacts.
- The dev script sets `WATCHPACK_POLLING=true` for file watching compatibility.

### Environment Variables

Copy `.env.example` to `.env.local`. Key variables:
- `USE_LOCAL_EVENTS=true` — bypass Supabase for event CRUD
- `OPENAI_API_KEY` — needed only for AI interview agent, transcription, and song seed generation
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — needed for full features (agent interviews, live prompt games)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — needed only for captcha-protected forms

### Project Structure

- `app/` — Next.js App Router pages and API routes
- `app/api/` — Backend API routes (events, agent interview, transcribe, summarize, live-prompt-game, auth)
- `components/` — Shared React components
- `lib/` — Server-side utilities (Supabase client, OpenAI, transcription, Turnstile)
- `data/` — Client-side data layer (API clients)
- `supabase/` — SQL migration files for Supabase PostgreSQL schema
- `types/` — TypeScript type definitions
