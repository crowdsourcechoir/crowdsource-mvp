# Agent briefs

One brief per living-system domain. A brief is the **handoff document** for that domain's
persistent agent thread: it holds everything a fresh agent needs to take over when the old
chat gets too long to keep going.

The domains themselves are defined in `docs/octo-living-system-workspace.md`. This folder is
where each one carries its working memory.

## The briefs

| Agent | Brief | Owns | Admin home |
|-------|-------|------|------------|
| OCTO | `docs/agent-briefs/octo.md` | Coherence, architecture, shared chrome, auth, deploy | `/admin/settings` |
| GARDEN | `docs/agent-briefs/garden.md` | Persistent participatory worlds | `/admin/gardens` |
| BLOOM | `docs/agent-briefs/bloom.md` | Live events and activations | `/admin/events` |
| ROOTS | `docs/agent-briefs/roots.md` | Hidden participation system | `/admin/roots` |
| LIVE | `docs/agent-briefs/live.md` | Runtime tools for active Blooms | `/admin/live` |
| COMPOSER | `docs/agent-briefs/composer.md` | Turning participation into music | `/admin/composer` |
| SALES | `docs/agent-briefs/sales.md` | Commercial distribution | `/admin/sales` |

New domain? Copy `docs/agent-briefs/_template.md`.

## The chat lifecycle

The whole point is that a domain outlives any single chat.

```text
open a domain chat  ->  agent reads its brief  ->  work happens
        ^                                              |
        |                                              v
   new chat, same domain  <-  archive chat  <-  agent updates its brief
```

### 1. Starting an agent for a domain

Open a new chat, name it after the domain, and paste the **Start a new agent** block from
that domain's brief. That block tells the agent which brief to read and what it owns. Nothing
else is needed — the brief carries the context the archived chat had.

### 2. While the chat runs

The agent stays inside its scope. When a request belongs to another domain, the agent says so
and names the domain instead of quietly reaching across. Boundaries are in each brief's
**Scope** section.

### 3. Before archiving a chat

Ask the agent to **update its brief**. It should:

1. Move anything finished from *Open threads* into *State of play → Working*.
2. Add or revise *Open threads* with what it learned and what it would do next.
3. Correct anything in the code map that its own work made stale.
4. Append one dated entry to the *Handoff log* — what changed, what to watch out for.
5. Commit and push, per `.cursor/rules/always-deploy-live.mdc`.

Then archive the chat. The brief is now the memory.

### 4. Starting the replacement

Same as step 1. The new agent reads the updated brief and picks up the open threads.

## What belongs in a brief

Load-bearing, durable facts: what the domain owns, where its code lives, what actually works
versus what is a prototype, the rules that are non-obvious enough to get wrong, and what is
in flight.

Not: transcripts, narration of past work, or anything already true in the code and easy to
find. A brief that restates the codebase rots. A brief that explains *what you would get
wrong* stays useful.

## Keeping them honest

`node scripts/check-agent-briefs.mjs` verifies every brief has the required sections and that
every repository path a brief cites still exists. Run it after editing a brief; stale paths
are the first way these documents go bad.
