# Sales Platform (AI-Assisted Prospecting)

Internal system for discovering, researching, scoring, and preparing outreach to organizations that are good candidates for a Crowdsource Choir participatory experience — with a human approving every outreach before it goes out.

This is not a new product. It lives inside the existing `crowdsource-mvp` app (`app.crowdsourcechoir.com`), as a second internal surface alongside the existing event-management admin.

## Why

Manually finding one good prospect, the right contact, doing the research, and drafting an email takes close to an hour today. The goal is a pipeline where AI does the discovery/research/drafting work in the background, and one person reviews and decides on 30–50 prepared opportunities per day.

## Documents

- [`architecture.md`](./architecture.md) — repository assessment, system architecture, routes/screens, background jobs, HubSpot approach, security, MVP boundaries
- [`database.md`](./database.md) — proposed schema, entity rationale, RLS approach
- [`ai-workflow.md`](./ai-workflow.md) — the staged pipeline (stage 0 discovery + 11 per-organization stages), structured-output contracts, scoring model, prompt-injection handling
- [`data-import.md`](./data-import.md) — mapping for the two initial seed CSVs (conference/association targets, real sports-org contacts) into the schema
- [`roadmap.md`](./roadmap.md) — phased plan and the first implementation milestone

## Status

Planning only. No migrations, packages, or production code have been added yet. See `roadmap.md` for the proposed first milestone and open questions awaiting approval.

## Non-negotiable principles (carried through every doc)

1. **Human-in-the-loop.** Nothing is emailed automatically in v1. Everything routes through an approval queue.
2. **Evidence before inference.** Every research claim used in scoring or drafting stores a source URL.
3. **Explainable scoring.** No bare AI-generated number — every score has components, rationale, confidence, and missing-info.
4. **Reusable across industries.** Organization types and opportunity types are data (lookup tables), not hardcoded enums or branching logic.
5. **Small, inspectable pipeline.** Staged, resumable steps with their own status/retry/provenance — not one opaque autonomous agent.
6. **Build the smallest coherent version first.** Favor the existing stack (Next.js/Vercel/Supabase/OpenAI) over adding new infrastructure unless there's a clear, stated reason.
