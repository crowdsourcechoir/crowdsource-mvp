import { listContactsForOrganization, updateContactVerification } from "../../db/contacts";
import { isPlausibleEmail, extractDomain, domainsMatch } from "../../dedupe";
import type { Organization } from "../../types";

export type VerifyContactsStageOutput = {
  checked: number;
  verifiedFormat: number;
  risky: number;
  invalid: number;
  noEmail: number;
};

/**
 * Deterministic only — no MX/SMTP probing in v1 (see docs/sales-platform/ai-workflow.md §5).
 * Format-valid + domain matches the org's own domain (including parent/subdomain pairs like
 * nacada.ksu.edu ↔ ksu.edu) → "valid_format".
 * Format-valid but a different domain (e.g. a personal/agency email) → "risky", still surfaced, never silently promoted.
 *
 * Enrichment-sourced guesses (Apollo/Hunter) that merely share a domain are still only
 * "risky": several @aorn.org Hunter hits bounced in production, so same-domain alone is not
 * enough evidence to clear the queue gate. Page-literal / human-verified addresses remain
 * eligible for valid_format / verified_deliverable.
 */
export async function runVerifyContactsStage(org: Organization): Promise<{ output: VerifyContactsStageOutput }> {
  const contacts = await listContactsForOrganization(org.id);
  const output: VerifyContactsStageOutput = { checked: 0, verifiedFormat: 0, risky: 0, invalid: 0, noEmail: 0 };

  for (const contact of contacts) {
    if (contact.emailVerificationStatus !== "unverified") continue;
    output.checked += 1;
    if (!contact.email) {
      output.noEmail += 1;
      continue;
    }
    if (!isPlausibleEmail(contact.email)) {
      await updateContactVerification(contact.id, "invalid");
      output.invalid += 1;
      continue;
    }
    const contactDomain = extractDomain(contact.email.split("@")[1]);
    const orgDomain = org.domain;
    const sameOrgDomain = domainsMatch(contactDomain, orgDomain);
    // Paid enrichment is a guess from a third-party DB — never auto-promote to queue-ready.
    if (contact.enrichmentProvider && contact.enrichmentStatus === "found") {
      await updateContactVerification(contact.id, "risky");
      output.risky += 1;
      continue;
    }
    if (orgDomain && contactDomain && !sameOrgDomain) {
      await updateContactVerification(contact.id, "risky");
      output.risky += 1;
    } else {
      await updateContactVerification(contact.id, "valid_format");
      output.verifiedFormat += 1;
    }
  }

  return { output };
}
