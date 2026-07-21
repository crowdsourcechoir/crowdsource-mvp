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

/**
 * Deterministic only — no MX/SMTP probing in v1 (see docs/sales-platform/ai-workflow.md §5).
 * Format-valid + domain matches the org's own domain → "valid_format".
 * Format-valid but a different domain (e.g. a personal/agency email) → "risky", still surfaced, never silently promoted.
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
    if (orgDomain && contactDomain && contactDomain !== orgDomain) {
      await updateContactVerification(contact.id, "risky");
      output.risky += 1;
    } else {
      await updateContactVerification(contact.id, "valid_format");
      output.verifiedFormat += 1;
    }
  }

  return { output };
}
