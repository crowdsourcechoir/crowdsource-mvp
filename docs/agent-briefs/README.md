# Agent briefs

One brief per living-system domain. A brief is the **handoff document** for that domain's
persistent agent thread: everything a fresh agent needs when the old chat gets too long.

The domains themselves are defined in `docs/octo-living-system-workspace.md`. This folder is
where each one carries its working memory and its north star.

## The briefs

| Agent | Brief | Owns | Admin home |
|-------|-------|------|------------|
| OCTO | `docs/agent-briefs/octo.md` | System coherence, shared chrome, auth, deploy, **cross-system verification** | `/admin/settings` |
| GARDEN | `docs/agent-briefs/garden.md` | Persistent participatory worlds | `/admin/gardens` |
| BLOOM | `docs/agent-briefs/bloom.md` | Live events and activations | `/admin/events` |
| ROOTS | `docs/agent-briefs/roots.md` | The Root System — participation methodology | `/admin/roots` |
| LIVE | `docs/agent-briefs/live.md` | Runtime tools for active Blooms | `/admin/live` |
| COMPOSER | `docs/agent-briefs/composer.md` | Turning participation into music | `/admin/composer` |
| SALES | `docs/agent-briefs/sales.md` | Commercial distribution | `/admin/sales` |

New domain? Copy `docs/agent-briefs/_template.md`.

## The chat lifecycle

A domain outlives any single chat.

```text
open a domain chat  →  agent reads its brief  →  work happens
        ^                                              |
        |                                              v
   new chat, same domain  ←  archive chat  ←  agent updates its brief
```

### 1. Starting an agent for a domain

Open a new chat, name it after the domain, and paste the **Start a new agent** block from
that domain's brief. That block tells the agent which brief to read and what it owns.

### 2. While the chat runs

The agent stays inside its scope. When a request belongs to another domain, the agent says so
and names the domain instead of quietly reaching across. Boundaries live in each brief's
**Scope** section.

Cross-cutting verification after changes is **OCTO's** job — see below.

### 3. Before archiving a chat

Ask the agent to **update its brief**. It should:

1. Move finished items from *Open threads* into *State of play → Alive now*.
2. Add or revise *Open threads* with what it learned and what it would do next.
3. Correct anything in the code map that its own work made stale.
4. Append one dated entry to the *Handoff log* — what changed, what to watch for.
5. Commit and push, per `.cursor/rules/always-deploy-live.mdc`.

Then archive the chat. The brief is now the memory.

### 4. Starting the replacement

Same as step 1. The new agent reads the updated brief and picks up the open threads.

## OCTO verifies the whole

Domain agents ship features. **OCTO certifies that the living system still coheres.**

After a meaningful change — especially before trusting production — open or resume the OCTO
chat and ask it to run the **System coherence pass** in `docs/agent-briefs/octo.md`
(section 4). Start with:

```bash
node scripts/octo-coherence-pass.mjs
```

Then complete the seam and production-pulse checks from the brief. Joel should be able to
archive a feature chat and still trust OCTO to say whether the whole holds.

## What belongs in a brief

Load-bearing facts and the **north star**: what the domain is becoming, where its code lives,
what is alive vs growing vs growing into, the rules that are easy to get wrong, and what is
in flight.

Write aspirationally and specifically. Name the destination (`Protocols/`, the living-system
map, the product vision) and be precise about current maturity — *Alive now*, *Growing now*,
*Growing into*. Do not flatten the vision to match today's UI, and do not pretend unfinished
work already ships.

Not: transcripts, narration of past work, or anything already true in the code and easy to
find. A brief that only restates the codebase rots. A brief that carries direction *and*
gotchas stays useful.

## Keeping them honest

`node scripts/check-agent-briefs.mjs` verifies every brief has the required sections and that
every repository path a brief cites still exists. Run it after editing a brief; stale paths
are the first way these documents go bad.
