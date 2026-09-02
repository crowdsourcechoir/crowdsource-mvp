import { listContactsForOrganization, updateContactVerification } from "../../db/contacts";
import { isPlausibleEmail, extractDomain } from "../../dedupe";
import type { Organization } from "../../types";

export type VerifyContactsStageOutput = {
  checked: number;
  verifiedFormat: number;
  risky: number;
  invalid: number;
  noEmail: number;
};

/** University / NCAA athletics orgs whose public site is often not the staff mailbox domain. */
export function orgLooksLikeUniversityOrAthletics(name?: string | null, domain?: string | null): boolean {
  const blob = `${name ?? ""} ${domain ?? ""}`.toLowerCase();
  return /\b(university|universities|athletics|college|collegiate|ncaa)\b/.test(blob);
}

/** True when email domain matches the org domain or a parent/child (conference.shrm.org ↔ shrm.org). */
export function emailDomainMatchesOrg(
  contactDomain: string | null,
  orgDomain: string | null,
  org?: { name?: string | null }
): boolean {
  if (!contactDomain || !orgDomain) return false;
  if (contactDomain === orgDomain) return true;
  if (orgDomain.endsWith(`.${contactDomain}`) || contactDomain.endsWith(`.${orgDomain}`)) return true;
  // Athletics sites (gohuskies.com, gozags.com) vs staff mail (@uw.edu, @gonzaga.edu).
  if (contactDomain.endsWith(".edu") && orgLooksLikeUniversityOrAthletics(org?.name, orgDomain)) {
    return true;
  }
  return false;
}

/**
 * Deterministic only — no MX/SMTP probing in v1 (see docs/sales-platform/ai-workflow.md §5).
 * Format-valid + domain matches the org's own domain (or parent/child) → "valid_format".
 * Format-valid university `.edu` on an athletics/university org also matches (Sidearm sites).
 * Format-valid but a different domain (e.g. a personal/agency email) → "risky", still surfaced,
 * never silently promoted. A human click in the queue can promote `risky` to `valid_format`.
 */
export async function runVerifyContactsStage(org: Organization): Promise<{ output: VerifyContactsStageOutput }> {
  const contacts = await listContactsForOrganization(org.id);
  const output: VerifyContactsStageOutput = { checked: 0, verifiedFormat: 0, risky: 0, invalid: 0, noEmail: 0 };

  for (const contact of contacts) {
    // Re-check risky when org domain may have been wrong (e.g. conference.* vs apex) so a later
    // reprocess can promote shrm.org emails for conference.shrm.org orgs.
    if (
      contact.emailVerificationStatus !== "unverified" &&
      contact.emailVerificationStatus !== "risky"
    ) {
      continue;
    }
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
    if (!emailDomainMatchesOrg(contactDomain, org.domain, org)) {
      await updateContactVerification(contact.id, "risky");
      output.risky += 1;
    } else {
      await updateContactVerification(contact.id, "valid_format");
      output.verifiedFormat += 1;
    }
  }

  return { output };
}
