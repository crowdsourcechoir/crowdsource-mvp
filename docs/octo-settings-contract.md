# OCTO Settings contract

Settings is the **master control plane** for Crowdsource Choir admin (OCTO). Feature pages operate the living system; Settings steers how the system looks and how shared integrations/defaults behave.

## Hub

- Route: `/admin/settings`
- Data: `lib/settings/catalog.ts` (`SETTINGS_GROUPS`)
- UI: card grid only — no embedded editors on the hub

## Subpages

- Route: `/admin/settings/<card.id>`
- Shell: `components/settings/SettingsSubpage.tsx` (always includes `← Settings`)
- Example (live): `/admin/settings/design-system`

## Design system

- Tokens: `lib/design-system/tokens.ts` (localStorage `csc_design_system_v1`)
- Provider: `components/DesignSystemProvider.tsx` (wired in `components/AdminLayoutClient.tsx`)
- CSS primitives: `.csc-list`, `.csc-list-row`, `.csc-link`, `.csc-btn-circle`, `.csc-eyebrow` + `--csc-*` variables in `app/globals.css`

Any new admin UI must consume these. Do not fork chrome.

## Workspace settings store

Operator overrides that must outlive a browser live in `lib/settings/store.ts`, a JSON object in Supabase Storage (`workspace-settings/v1.json`). It needs no schema migration and degrades to env defaults when storage is unavailable (`persisted: false` plus a `storeError`).

Pattern for a new master control:

1. Add the override field to `WorkspaceSettings` and its normalizer.
2. Resolve stored override over env default in a domain resolver (see `lib/sales/digest/settings.ts`).
3. Read the resolver everywhere the value is consumed — never read the env var directly at the call site.
4. Expose `GET` / `PATCH` under the feature's API namespace and surface it on the Settings subpage.

Chrome-only preferences (Design system, sidebar) stay in `localStorage`.

## Card statuses

| Status | Meaning |
|--------|---------|
| `live` | Settings subpage (or shared shell) exists |
| `coming_next` | Card reserved; not built |
| `legacy_deeplink` | Temporarily opens a feature page — migrate controls into Settings |
| `policy` | Safety aggregation; confirm-gated |

## Implementation rule for agents

1. Prefer extending catalog + Settings subpage over new config UI elsewhere.
2. When migrating a `legacy_deeplink` card, set `href` to `/admin/settings/<id>`, `status` to `live`, and update `statusLabel` (e.g. `Edit`).
3. Update the card’s `controls` array to match what the page actually exposes.
