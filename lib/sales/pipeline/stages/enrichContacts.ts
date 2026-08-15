import { listContactsForOrganization, markContactEnriched } from "../../db/contacts";
import { activeEnrichmentProvider, enrichContactEmail } from "../../enrichment";
import { looksLikePersonName } from "../../dedupe";
import type { Contact, Organization } from "../../types";

export type EnrichContactsStageOutput = {
  provider: "apollo" | "hunter" | null;
  attempted: number;
  found: number;
  skippedNoDomain: boolean;
};

const MAX_ENRICHMENT_PER_RUN = 3; // hard cap on paid API calls per pipeline run — this is a cost control, not a quality one
const DECISION_MAKER_ROLE_PATTERN = /director|president|executive|head\b|chief|coordinator|manager|founder|dean|principal/i;

/** Named people with no email yet, ranked so a decision-maker-sounding title is tried before a generic one (e.g. "board governor"), then by discovery order.
 * Prior provider errors (Apollo free-plan 403, Hunter 429, etc.) are retryable — only a
 * definitive found/not_found burns the contact for future runs.
 */
function rankEnrichmentCandidates(contacts: Contact[]): Contact[] {
  const candidates = contacts.filter((c) => {
    if (!looksLikePersonName(c.fullName) || c.email) return false;
    if (!c.enrichmentAttemptedAt) return true;
    return c.enrichmentStatus === "error";
  });
  return [...candidates].sort((a, b) => {
    const roleRank = (c: Contact) => (DECISION_MAKER_ROLE_PATTERN.test(c.roleTitle ?? "") ? 0 : 1);
    const diff = roleRank(a) - roleRank(b);
    return diff !== 0 ? diff : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Phase 2: fills in missing emails for named people already discovered from an org's own
 * website (stage 4) via Hunter.io Email Finder if HUNTER_API_KEY is set,
 * else this stage is a no-op (never blocks the
 * pipeline; a human can always find/verify an email manually at review time either way). Never
 * invents an email itself — every email either comes verbatim from the org's own site (stage 4)
 * or from the enrichment provider's own database.
 */
export async function runEnrichContactsStage(org: Organization): Promise<{ output: EnrichContactsStageOutput }> {
  const provider = activeEnrichmentProvider();
  if (!provider) {
    return { output: { provider: null, attempted: 0, found: 0, skippedNoDomain: false } };
  }
  if (!org.domain) {
    return { output: { provider, attempted: 0, found: 0, skippedNoDomain: true } };
  }

  const contacts = await listContactsForOrganization(org.id);
  const candidates = rankEnrichmentCandidates(contacts).slice(0, MAX_ENRICHMENT_PER_RUN);

  let found = 0;
  for (const contact of candidates) {
    const nameParts = (contact.fullName ?? "").trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");
    if (!firstName || !lastName) continue; // enrichment APIs need both; a single-word name isn't enough to match confidently

    const result = await enrichContactEmail({ firstName, lastName, domain: org.domain });
    if (!result) break; // provider became unavailable mid-run (shouldn't happen, but never loop on nothing)
    await markContactEnriched(contact.id, { provider: result.provider, status: result.status, email: result.email });
    if (result.status === "found") found += 1;
  }

  return { output: { provider, attempted: candidates.length, found, skippedNoDomain: false } };
}
