# Crowdsource Platform V2 (Community) — Plan

Status: **spine cut** (Garden Agent) — see PR for this branch  
Depends on: `docs/song-garden-v2/persistent-world-spec.md`, `docs/octo-living-system-workspace.md`  
Pilot lab: Populus shows (R&D) — not gated on Gonzaga

---

## North star

Contribution becomes creation, creation becomes culture, culture invites deeper participation.

Platform V2 is the **community spine** under Song Garden (and future modalities). Song Garden WorldJourney remains a modality UX — not the platform.

## Locked decisions

1. **Identity:** BOTH modes, configurable per Garden (Bloom may override)
   - `open` — anonymous-first (device id) + optional claim
   - `account_required` — must claim (display name + email bound to device) before contribute/react
2. **Pilot:** Populus shows
3. **Recognition:** in-Garden credit AND exportable social/performance credit packs
4. **Respond:** React only (no reply/remix)
5. **Participation Index v0** (Learfield-sellable via Sales packaging):
   - Participation rate = contributors ÷ reachable audience
   - Sponsored participation volume = contributions + reacts in a campaign window
   - Activation reach = people who performed/encountered the piece (with credit path back)

## Spine cut (this PR)

| # | Capability | Shape |
|---|---|---|
| 1 | Identity mode + anon/claim | `gardens.community` + `garden_participant_identities` |
| 2 | Contribution graph + rights | `garden_contribution_nodes` (rights required) |
| 3 | Recognition emits | `garden_recognition_events` on select / perform / amplify |
| 4 | React | `garden_contribution_reacts` (heart) → amplify recognition |
| 5 | Dual credit | in-Garden list on snapshot/API + `GET …/credit-pack` |
| 6 | Index metrics | `GET …/index` with three metrics |

## Non-goals (explicit)

- Creation Engine (V3), enterprise multi-tenant (V4)
- Reply/remix, social feed, XP theater
- Renaming Platform V2 as Song Garden V2 WorldJourney
- Encoding Roots methodology as code (document for Roots review only)
- Sales CRM writes — Index/export shapes only

## Seams left open

- **Composer:** `POST …/contributions/:ref/select` → recognition `selected`
- **Live:** `POST …/contributions/:ref/perform` → recognition `performed` + optional activation reach bump
- **Sales:** Index JSON is packaging-ready; no CRM mutation

## Rights (required on graph nodes)

```ts
{
  publicDisplay: boolean;
  showUse: boolean;
  sponsorUse: boolean;
  socialPosting: boolean;
}
```

Defaults come from contribution consent at write time; nodes without rights are not discoverable.

## Roots (out of band)

Invitation / risk / belonging rules stay with Roots methodology — not encoded here.
If Platform V2 needs invitation or belonging gates beyond identity mode, document requirements for Roots review rather than shipping them as product logic.

## Definition of done

On a Populus-style Garden/Bloom a participant can: contribute under the configured identity mode; discover selected contributions; react; see in-Garden credit; and we can export a credit pack + the three Index metrics for a sponsor conversation.

## Human UI (follow-on)

See `docs/platform-v2-wysiwyg-garden-edit.md` — Community admin is plain language (no JSON); primary edit is `/g/[slug]?edit=1` with ⋮ settings.
