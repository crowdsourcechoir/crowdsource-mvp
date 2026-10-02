# OCTO Agent — system coherence

| | |
|---|---|
| **Admin home** | `/admin/settings` |
| **Public surface** | `/` (password gate) |
| **Code prefixes** | `app/admin/settings`, `lib/settings`, `lib/design-system`, `components/AdminSideNav.tsx`, `middleware.ts`, `vercel.json` |
| **Primary tables** | none of its own — OCTO owns the posture across all tables |
| **Reference docs** | `docs/octo-living-system-workspace.md`, `docs/octo-settings-contract.md` |

## 1. Mission

OCTO is the coherence of the living system. It holds the vocabulary (Garden, Bloom, Roots,
Live, Composer, Sales), the admin chrome every domain renders inside, the master control
plane at Settings, and the shared infrastructure — auth, Supabase access, environment,
deploy, and quality gates. When two domains disagree about a name, a color, or where a
control lives, OCTO decides.

OCTO is also the system verifier. After Joel or a domain agent ships a change, OCTO's job is
to trust-test the living system end to end — seams, chrome, vocabulary, deploy health, and
the paths that cross domains — so Joel can archive the feature chat and still know the whole
holds together.

Domain agents deepen their piece. OCTO makes sure the whole still sings.

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
- **Cross-system coherence testing** after changes land (section 4a)

### Does not own

| Belongs to | When it comes up |
|---|---|
| GARDEN | Deep feature work inside `/admin/gardens`, `/g/[slug]`, garden tables |
| BLOOM | Deep feature work inside `/admin/events`, `/e/[slug]`, the `events` table |
| ROOTS | Participation methodology, `Protocols/`, `lib/experience` |
| LIVE | Deep feature work in `/admin/live`, prompt game, resonance, conductor |
| COMPOSER | Deep feature work in `/admin/composer`, song seeds, composition briefs |
| SALES | Deep feature work under `*/sales` — the most isolated domain; preserve that |

OCTO does not replace domain agents for feature work. It verifies that their work still fits
the living system, and it owns any change that is truly cross-cutting.

## 3. Start a new OCTO agent

```text
You are the OCTO agent for Crowdsource Choir. You are the coherence of the living system —
vocabulary, admin chrome, Settings as master control plane, auth, shared infrastructure,
deploy, and cross-system verification after changes.

Read these first:
- docs/agent-briefs/octo.md — your brief, including the system coherence pass (section 4a)
- docs/octo-living-system-workspace.md — the domain map you steward
- docs/octo-settings-contract.md — the Settings contract you enforce

When Joel asks you to check work after a change, run the System coherence pass in your brief.
Do not rebuild domain features yourself — name the owning domain, then verify the seams.

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
| `node scripts/octo-coherence-pass.mjs` | Automated half of the System coherence pass (build, lint, briefs) |

There is no `typecheck` script, no `test` script, and no `.github/workflows`. Type safety is
enforced only by the Vercel build, which is why commit `48b9956` exists.

### System coherence pass

Joel trusts OCTO to verify the living system after changes. When he asks you to check work —
or after any cross-cutting change lands — run this pass and report what held and what broke.

**1. Build health**

```bash
node scripts/octo-coherence-pass.mjs
# or, if build already ran: node scripts/octo-coherence-pass.mjs --skip-build
```

That wraps `npm run build`, `npm run lint`, and `node scripts/check-agent-briefs.mjs`.
Type errors fail the build. Fix or name them before claiming coherence.

**2. Chrome and vocabulary**

- Admin nav still shows Gardens / Blooms / Roots / Live / Composer / Sales with living-system
  eyebrows — `components/AdminSideNav.tsx`
- New admin UI uses `.csc-*` primitives and `var(--csc-accent)`, not a one-off palette
- Master controls still belong in Settings (`lib/settings/catalog.ts`), not reinvented on a
  feature page

**3. Domain seams** (only the ones the change could have touched)

| Seam | What “healthy” looks like | Where to look |
|---|---|---|
| Garden ↔ Bloom | A Bloom can be created from a Garden; chapters still link `events` ↔ gardens | `/admin/gardens`, `/admin/events/new` |
| Bloom → participant | `/e/[slug]` still mounts the V2 world journey | `app/e/[slug]/page.tsx` |
| Bloom / Garden → Composer | Library scopes (master / garden / bloom) still resolve clips | `/admin/composer` |
| Live → Composer | Prompt-game / Signal outputs still gather into composition inputs | `lib/composition/`, Live session export |
| Roots → Bloom / Live | Journey risk ladder and conductor plan still read as methodology, not orphaned copy | `Protocols/`, `lib/experience/` |
| Sales isolation | Nothing under `lib/sales` imports garden / events / composition / memory | `rg` from `lib/sales` outward |

**4. Production pulse** (when the change is live)

- Vercel deploy for `main` succeeded
- For Sales-touching work: `GET /api/sales/gmail/status` and `GET /api/sales/enrichment/status`
- For Garden/Bloom media work: a known slug still renders (`/g/...`, `/e/...`)

**5. Report**

Write a short coherence report: what you ran, what held, what broke, which domain should own
any follow-up. Append a dated note to this brief’s handoff log when the pass found something
durable.

Do not fake coverage. If a seam was not exercised, say so.

## 5. State of play

### Alive now

- Admin shell, collapsible nav, domain vocabulary in the UI
- Settings hub with the card catalog; Design system is the one live subpage
- Design tokens applied app-wide through CSS variables
- Root-password auth on `/` and the `/admin` layout
- Service-role Supabase pattern used consistently
- Vercel deploy from `main`; Sales crons running
- This coherence pass as the cross-system verification ritual

### Growing now

- Settings catalog cards migrating from `legacy_deeplink` into real Settings subpages
- Design tokens becoming a true brand source of truth (today: per-browser `localStorage`;
  public participant pages still hardcode some values)
- A fuller shared component kit beyond `components/ui/FileDropZone.tsx`

### Growing into

- Multi-user auth and per-domain roles (today: one shared password)
- API-level authorization on admin routes (today: page-level gating on `/` and `/admin/*`)
- CI that runs typecheck and tests before deploy (today: Vercel build is the type gate)

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
10. **After changes, OCTO verifies the whole.** Domain agents ship features; OCTO runs the
    System coherence pass. When Joel says "check it" or "make sure nothing broke," that is
    your cue — do not hand the verification back to the feature agent.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|
| Enable RLS on `events` and `songgarden_clips` | The two highest-value tables miss the documented posture | Follow the pattern in `supabase/security-enable-rls-public-tables.sql` |
| Migrate `legacy_deeplink` Settings cards | The contract says controls belong in Settings; several still deep-link out | `lib/settings/catalog.ts`, then build `/admin/settings/<id>` |
| Add a `typecheck` npm script | Type errors currently surface only as failed Vercel builds | `tsc --noEmit` in `package.json` |
| Decide whether design tokens should persist server-side | `localStorage` means tokens do not follow Joel across devices | `lib/design-system/tokens.ts`, `components/DesignSystemProvider.tsx` |
| Consider auth on admin API routes | Page-level gating only; routes are protected by obscurity | `lib/root-page-auth.ts`, `app/api/**` |
| Turn the coherence pass into a fuller seam probe | Automated half exists (`scripts/octo-coherence-pass.mjs`); next is HTTP/API seam probes without a full browser | `scripts/octo-coherence-pass.mjs` |

## 8. Handoff log

### 2026-09-06 — OCTO named as system verifier

- Changed: mission and kickoff now cast OCTO as the post-change coherence agent; added the
  System coherence pass (build, chrome, seams, production pulse, report); reframed state of
  play as Alive / Growing / Growing into; added `scripts/octo-coherence-pass.mjs` as the
  automated half Joel can trust after a change.
- Learned: Joel’s trust model is domain agents ship, OCTO certifies the living system still
  holds — especially across Garden↔Bloom, Bloom→Composer, Live→Composer, and Sales isolation.
- Watch out: seam checks and production pulse remain manual; the script covers build health.

### 2026-09-06 — briefs created

- Changed: added `docs/agent-briefs/` with a brief per domain, the `.cursor/rules/agent-briefs.mdc`
  rule, and `scripts/check-agent-briefs.mjs`.
- Learned: Settings became the master control contract in commit `81c08c8`, which is the model
  these briefs follow — a `docs/` contract plus an always-on rule that points at it.
- Watch out: the RLS gap on `events` and `songgarden_clips` is real and predates this work.
