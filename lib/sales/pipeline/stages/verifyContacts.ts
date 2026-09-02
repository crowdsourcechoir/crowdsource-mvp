import { listContactsForOrganization, updateContactVerification } from "../../db/contacts";
import { isPlausibleEmail, extractDomain } from "../../dedupe";
import { verifyEmailAddress } from "../../enrichment/verify-email";
import type { Contact, Organization } from "../../types";

export type VerifyContactsStageOutput = {
  checked: number;
  verifiedFormat: number;
  verifiedDeliverable: number;
  risky: number;
  invalid: number;
  noEmail: number;
  hunterAttempted: number;
};

const MAX_HUNTER_VERIFY_PER_RUN = 5;

/** True when email domain matches the org domain or a parent/child (conference.shrm.org ↔ shrm.org). */
export function emailDomainMatchesOrg(contactDomain: string | null, orgDomain: string | null): boolean {
  if (!contactDomain || !orgDomain) return false;
  if (contactDomain === orgDomain) return true;
  return orgDomain.endsWith(`.${contactDomain}`) || contactDomain.endsWith(`.${orgDomain}`);
}

export function contactNeedsHunterVerify(contact: Contact): boolean {
  if (!contact.email || !isPlausibleEmail(contact.email)) return false;
  return (
    contact.emailVerificationStatus === "unverified" ||
    contact.emailVerificationStatus === "risky" ||
    contact.emailVerificationStatus === "valid_format"
  );
}

/**
 * Format + org-domain check, then Hunter Email Verifier (SMTP) so undeliverable
 * mailboxes never clear the queue bar. `valid_format` alone is not sendable.
 */
export async function runVerifyContactsStage(org: Organization): Promise<{ output: VerifyContactsStageOutput }> {
  const contacts = await listContactsForOrganization(org.id);
  const output: VerifyContactsStageOutput = {
    checked: 0,
    verifiedFormat: 0,
    verifiedDeliverable: 0,
    risky: 0,
    invalid: 0,
    noEmail: 0,
    hunterAttempted: 0,
  };

  let hunterLeft = MAX_HUNTER_VERIFY_PER_RUN;

  for (const contact of contacts) {
    if (contact.emailVerificationStatus === "verified_deliverable" || contact.emailVerificationStatus === "invalid") {
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
    if (!emailDomainMatchesOrg(contactDomain, org.domain)) {
      await updateContactVerification(contact.id, "risky");
      output.risky += 1;
      continue;
    }

    await updateContactVerification(contact.id, "valid_format");
    output.verifiedFormat += 1;

    if (hunterLeft <= 0) continue;
    hunterLeft -= 1;
    output.hunterAttempted += 1;
    const hunter = await verifyEmailAddress(contact.email);
    if (hunter.status === "unverified") continue;
    await updateContactVerification(contact.id, hunter.status);
    if (hunter.status === "verified_deliverable") output.verifiedDeliverable += 1;
    else if (hunter.status === "invalid") output.invalid += 1;
    else if (hunter.status === "risky") output.risky += 1;
  }

  return { output };
}
