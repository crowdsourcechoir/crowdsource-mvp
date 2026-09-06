# OCTO Agent — maintain coherence

| | |
|---|---|
| **Admin home** | `/admin/settings` |
| **Public surface** | `/` (password gate) |
| **Code prefixes** | `app/admin/settings`, `lib/settings`, `lib/design-system`, `components/AdminSideNav.tsx`, `middleware.ts`, `vercel.json` |
| **Primary tables** | none of its own — OCTO owns the posture across all tables |
| **Reference docs** | `docs/octo-living-system-workspace.md`, `docs/octo-settings-contract.md` |

## 1. Mission

OCTO keeps the six product domains feeling like one system. It owns the vocabulary
(Garden, Bloom, Roots, Live, Composer, Sales), the admin chrome every domain renders inside,
the master control plane at Settings, and the shared infrastructure — auth, Supabase access
pattern, environment, deploy, and quality gates. When two domains disagree about a name, a
color, or where a control lives, OCTO decides.

It is the only domain whose job is explicitly *not* to ship a feature.

## 2. Scope

### Owns

- Living-system vocabulary and the map in `docs/octo-living-system-workspace.md`
- Admin shell and navigation: `components/AdminSideNav.tsx`, `components/AdminShell.tsx`, `components/AdminLayoutClient.tsx`
- Settings as master control plane: `lib/settings/catalog.ts`, `app/admin/settings/page.tsx`, `components/settings/SettingsSubpage.tsx`
- Design system tokens and CSS primitives: `lib/design-system/tokens.ts`, `components/DesignSystemProvider.tsx`, `app/globals.css`
- Auth: `lib/root-page-auth.ts`, `app/api/auth`, `app/admin/layout.tsx`, `middleware.ts`
- Supabase access pattern: `lib/supabase-server.ts` and the service-role-only convention
- Deploy and cron config: `vercel.json`, `scripts/prod-preflight.mjs`
- RLS posture across every domain's tables
- These briefs, and the always-on rules in `.cursor/rules`

### Does not own

| Belongs to | When it comes up |
|---|---|
| GARDEN | Anything inside `/admin/gardens`, `/g/[slug]`, garden tables |
| BLOOM | Anything inside `/admin/events`, `/e/[slug]`, the `events` table |
| ROOTS | Participation methodology, `Protocols/`, `lib/experience` |
| LIVE | `/admin/live`, prompt game, resonance, conductor |
| COMPOSER | `/admin/composer`, song seeds, composition briefs, clip audio |
| SALES | Everything under `*/sales` — the most isolated domain, keep it that way |

OCTO reviews how those domains use shared chrome. It does not build their features.

## 3. Start a new OCTO agent

```text
You are the OCTO agent for Crowdsource Choir. You maintain coherence across the living
system — vocabulary, admin chrome, Settings as master control plane, auth, shared
infrastructure, and deploy.

Read these first:
- docs/agent-briefs/octo.md — your brief, including open threads
- docs/octo-living-system-workspace.md — the domain map you are the steward of
- docs/octo-settings-contract.md — the Settings contract you enforce

You do not build features inside Garden, Bloom, Roots, Live, Composer, or Sales. When a
request is a feature in one of those, say which domain owns it. You do review how those
domains consume shared chrome, and you own any change that touches all of them at once.

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### Shell and navigation

| File | Purpose |
|---|---|
| `app/admin/layout.tsx` | Auth gate; redirects to `/` when the root cookie is wrong |
| `components/AdminLayoutClient.tsx` | Mounts `DesignSystemProvider` around the shell |
| `components/AdminShell.tsx` | Side nav plus main content region |
| `components/AdminSideNav.tsx` | Domain nav; the labels below are the vocabulary in practice |
| `app/admin/page.tsx` | `/admin` redirects to `/admin/gardens` |

Nav labels and eyebrows, which are the user-facing form of the domain map:

| Label | Eyebrow | Href |
|---|---|---|
| Gardens | Persistent Worlds | `/admin/gardens` |
| Blooms | Live Events | `/admin/events` |
| Roots | Root System | `/admin/roots` |
| Live | Runtime Tools | `/admin/live` |
| Composer | Musical Formation | `/admin/composer` |
| Sales | Prospecting Intelligence | `/admin/sales` |

### Settings and design system

| File | Purpose |
|---|---|
| `lib/settings/catalog.ts` | `SETTINGS_GROUPS` — every master control card and its status |
| `app/admin/settings/page.tsx` | Hub; card grid only, no embedded editors |
| `components/settings/SettingsSubpage.tsx` | Shared subpage shell with the `← Settings` link |
| `app/admin/settings/design-system/page.tsx` | The one live subpage today |
| `components/settings/DesignSystemControls.tsx` | Token editor |
| `lib/design-system/tokens.ts` | Token defaults; persisted in `localStorage` under `csc_design_system_v1` |
| `components/DesignSystemProvider.tsx` | Applies tokens as CSS variables on `<html>` |
| `app/globals.css` | `--csc-*` variables and `.csc-list`, `.csc-list-row`, `.csc-link`, `.csc-btn-circle`, `.csc-eyebrow` |

Token defaults: accent `#CFFF81` (lime), shell background `#000000`, row divider
`rgba(255,255,255,0.10)`, row padding 16, outline width 1, circle button 32.

### Auth

| File | Purpose |
|---|---|
| `lib/root-page-auth.ts` | HMAC-SHA256 token in the `root_auth` cookie, 7 day life |
| `app/api/auth/login/route.ts` | Verifies `ROOT_PAGE_PASSWORD`, sets the cookie |
| `app/api/auth/session/route.ts` | Session check |
| `app/api/auth/reset-root-password/route.ts` | Localhost only; writes a hash to `.data/root-page-password.json` |
| `app/HomePageGate.tsx` | The password form on `/` |
| `middleware.ts` | Deliberate passthrough — it exists to emit the manifest, not to gate |

### Shared infrastructure

| File | Purpose |
|---|---|
| `lib/supabase-server.ts` | `supabaseAdmin` — the single service-role client, `persistSession: false`, 8s timeout |
| `lib/supabase-table-errors.ts` | Tolerating missing columns from unapplied migrations |
| `lib/supabase-bytea.ts` | Legacy bytea audio helpers |
| `lib/http/public-cache.ts` | CDN cache headers for public reads |
| `lib/site-url.ts` | Canonical `app.crowdsourcechoir.com` |
| `lib/confirm-rare-delete.ts` | Shared confirm gate for destructive admin actions |

There is no browser Supabase client and no anon key. Every database read and write goes
through a Next.js route handler using the service role.

### Environment groups

`.env.example` is the full list. By group:

| Group | Variables |
|---|---|
| AI | `OPENAI_API_KEY` |
| Admin gate | `ROOT_PAGE_PASSWORD` |
| Local dev | `USE_LOCAL_EVENTS` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MEDIA_BUCKET` |
| Captcha | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Maps | `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` |
| Garden media | `RUNWAYML_API_SECRET`, `SONG_GARDEN_MEDIA_BUCKET` |
| Sales enrichment | `HUNTER_API_KEY` |
| Sales Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GMAIL_TOKEN_ENCRYPTION_KEY`, `SALES_GMAIL_SENDS_ENABLED` |
| Sales digest | `RESEND_API_KEY`, `SALES_DIGEST_TO_EMAIL`, `SALES_DIGEST_FROM_EMAIL`, and the `SALES_DIGEST_*` tuning set |
| Cron | `CRON_SECRET` |
| Public URL | `NEXT_PUBLIC_APP_URL` |

There is no Suno API key. Suno output is prompt text a human pastes.

### Deploy and quality gates

`vercel.json` holds exactly two things: one redirect from `crowdsource-mvp.vercel.app` to
the canonical domain, and 42 cron entries — all of them Sales
(`/api/sales/cron/pipeline`, `digest`, `gmail-sync`, `nudges`). Function timeouts are not in
`vercel.json`; they are per-route `export const maxDuration`.

| Command | What it does |
|---|---|
| `npm run build` | `next build`. TypeScript errors fail the build — this is the real type gate |
| `npm run lint` | `next lint` |
| `npm run preflight` | `scripts/prod-preflight.mjs`: checks required env, warns on `USE_LOCAL_EVENTS`, builds, probes Supabase REST, prints the SQL checklist |
| `node scripts/check-agent-briefs.mjs` | Validates these briefs |

There is no `typecheck` script, no `test` script, and no `.github/workflows`. Type safety is
enforced only by the Vercel build, which is why commit `48b9956` exists.

## 5. State of play

### Working

- Admin shell, collapsible nav, domain vocabulary in the UI
- Settings hub with the card catalog; Design system is the one live subpage
- Design tokens applied app-wide through CSS variables
- Root-password auth on `/` and the `/admin` layout
- Service-role Supabase pattern used consistently
- Vercel deploy from `main`; Sales crons running

### Partial or prototype

- Settings catalog has many `coming_next` and `legacy_deeplink` cards — the controls still
  live on feature pages and are meant to migrate in
- Design system tokens are per-browser `localStorage`, so they are an operator preference,
  not a brand source of truth. Public participant pages still hardcode some values
- `components/ui/` holds only `FileDropZone.tsx`; there is no real shared component kit

### Not built

- Multi-user auth or per-domain roles. One shared password for everything
- API-level authorization. Root auth guards `/` and `/admin/*` pages only; admin API routes
  under `app/api/**` are not gated by it
- Any CI. No GitHub Actions, no automated test run before deploy

## 6. Rules and gotchas

1. **The vocabulary split is deliberate.** UI says Bloom and Garden; the database and URLs
   say `events`. Do not "fix" this by renaming tables or routes. Keep both names visible in
   any doc you write.
2. **Settings owns master controls; feature pages consume them.** Before adding a toggle,
   default, API-key status, or schedule anywhere, check `lib/settings/catalog.ts`. The rule
   in `.cursor/rules/admin-settings-design-system.mdc` is `alwaysApply` and is not optional.
3. **Entity-specific editors stay on the entity.** One Bloom's journey belongs on that Bloom's
   page. *Defaults for new Blooms* belong in Settings.
4. **Never invent a second palette.** Use `var(--csc-accent)` and the `.csc-*` primitives.
5. **Service role only.** If you find yourself wanting a browser Supabase client, you are
   about to break the security model. Add a route handler instead.
6. **RLS coverage is uneven and this is the known gap.** `security-enable-rls-public-tables.sql`
   and `sales-platform-rls.sql` follow the enable-RLS-with-no-policies pattern, but
   `public.events` (`supabase/events-table.sql`) and `public.songgarden_clips`
   (`supabase/songgarden-tables.sql`) never enable it. Safe today only because no anon key
   ships. Do not introduce one without closing this first.
7. **Type errors reach production before you see them.** There is no CI. Run `npm run build`
   locally before pushing anything non-trivial.
8. **Push to `main` deploys live.** Per `.cursor/rules/always-deploy-live.mdc` there is no
   staging. Joel is the only user, so the bar is "does it work", not "is it staged".
9. **Sales is the isolation success case.** Nothing under `lib/sales` imports from events,
   songgarden, composition, or memory. Preserve that.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Enable RLS on `events` and `songgarden_clips` | The two highest-value tables miss the documented posture | Follow the pattern in `supabase/security-enable-rls-public-tables.sql` |
| Migrate `legacy_deeplink` Settings cards | The contract says controls belong in Settings; several still deep-link out | `lib/settings/catalog.ts`, then build `/admin/settings/<id>` |
| Add a `typecheck` npm script | Type errors currently surface only as failed Vercel builds | `tsc --noEmit` in `package.json` |
| Decide whether design tokens should persist server-side | `localStorage` means tokens do not follow Joel across devices | `lib/design-system/tokens.ts`, `components/DesignSystemProvider.tsx` |
| Consider auth on admin API routes | Page-level gating only; routes are protected by obscurity | `lib/root-page-auth.ts`, `app/api/**` |

## 8. Handoff log

### 2026-09-06 — briefs created

- Changed: added `docs/agent-briefs/` with a brief per domain, the `.cursor/rules/agent-briefs.mdc`
  rule, and `scripts/check-agent-briefs.mjs`.
- Learned: Settings became the master control contract in commit `81c08c8`, which is the model
  these briefs follow — a `docs/` contract plus an always-on rule that points at it.
- Watch out: the RLS gap on `events` and `songgarden_clips` is real and predates this work.
