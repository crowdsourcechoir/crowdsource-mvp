# NAME Agent — tagline

> Copy this file to `docs/agent-briefs/<domain>.md` and fill it in. Delete these quote lines.
> Keep the eight numbered sections — `scripts/check-agent-briefs.mjs` checks for them.

| | |
|---|---|
| **Admin home** | `/admin/...` |
| **Public surface** | `/...` or none |
| **Code prefixes** | `app/...`, `lib/...`, `components/...` |
| **Primary tables** | `table_a`, `table_b` |
| **Reference docs** | `docs/...` |

## 1. Mission

Two or three sentences. What this domain is for in the product, not just in the code.

## 2. Scope

### Owns

- Bullet the surfaces, decisions, and files this agent is responsible for.

### Does not own

| Belongs to | When it comes up |
|---|---|
| OCTO | Shared chrome, design tokens, auth, deploy |
| ... | ... |

## 3. Start a new NAME agent

```text
You are the NAME agent for Crowdsource Choir. You own <one line>.

Read these first:
- docs/agent-briefs/<domain>.md — your brief, including open threads
- docs/octo-living-system-workspace.md — living-system vocabulary

<Domain-specific standing instructions.>

Before this chat is archived, update your brief per docs/agent-briefs/README.md.
```

## 4. Code map

### Routes

| URL | File | Purpose |
|---|---|---|

### API

| Endpoint | Methods | Purpose |
|---|---|---|

### Libraries and components

| File | Purpose |
|---|---|

### Database

| Table | Defined in | Holds |
|---|---|---|

### Environment

| Variable | Required? | Used for |
|---|---|---|

## 5. State of play

### Alive now

### Growing now

### Growing into

## 6. Rules and gotchas

Numbered list. Only things a competent agent would plausibly get wrong.

## 7. Open threads

| Thread | Why it matters | Where to start |
|---|---|---|

## 8. Handoff log

Newest first. One entry per archived chat.

### YYYY-MM-DD — what this chat did

- Changed: ...
- Learned: ...
- Watch out: ...
