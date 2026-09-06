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
