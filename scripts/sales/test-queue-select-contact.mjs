/**
 * Queue picker shows named people with any email; select-contact used to reject
 * `risky` (athletics @uw.edu vs org domain gohuskies.com) so every click failed.
 *
 * Run: npx tsx scripts/sales/test-queue-select-contact.mjs
 */
import assert from "node:assert/strict";
import { hasSelectableOutreachEmail, hasVerifiedEmail, isPlausibleEmail, looksLikePersonName } from "../../lib/sales/dedupe.ts";
import { emailDomainMatchesOrg, orgLooksLikeUniversityOrAthletics } from "../../lib/sales/pipeline/stages/verifyContacts.ts";

function contact(overrides = {}) {
  return {
    id: "c1",
    organizationId: "org-1",
    fullName: "Shannon Kelly",
    roleTitle: "Deputy Athletic Director",
    roleCategory: null,
    outreachPersona: "other",
    email: "shannonk@uw.edu",
    normalizedEmail: "shannonk@uw.edu",
    phone: null,
    emailVerificationStatus: "risky",
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: null,
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function main() {
  assert.equal(looksLikePersonName("Shannon Kelly"), true);
  assert.equal(isPlausibleEmail("shannonk@uw.edu"), true);
  assert.equal(isPlausibleEmail("armead@uw.edu"), true);

  const risky = contact({ emailVerificationStatus: "risky", email: "armead@uw.edu" });
  assert.equal(hasVerifiedEmail(risky), false, "pipeline gate still rejects risky");
  assert.equal(hasSelectableOutreachEmail(risky), true, "queue click accepts format-valid risky");

  const unverified = contact({ emailVerificationStatus: "unverified" });
  assert.equal(hasSelectableOutreachEmail(unverified), true);

  const valid = contact({ emailVerificationStatus: "valid_format" });
  assert.equal(hasVerifiedEmail(valid), true);
  assert.equal(hasSelectableOutreachEmail(valid), true);

  const invalid = contact({ emailVerificationStatus: "invalid", email: "not-an-email" });
  assert.equal(hasSelectableOutreachEmail(invalid), false);

  const noEmail = contact({ email: null, emailVerificationStatus: "unverified" });
  assert.equal(hasSelectableOutreachEmail(noEmail), false);

  assert.equal(orgLooksLikeUniversityOrAthletics("University of Washington Athletics", "gohuskies.com"), true);
  assert.equal(orgLooksLikeUniversityOrAthletics("Gonzaga University Athletics", "gozags.com"), true);
  assert.equal(orgLooksLikeUniversityOrAthletics("Seattle Sounders FC", "soundersfc.com"), false);

  assert.equal(
    emailDomainMatchesOrg("uw.edu", "gohuskies.com", { name: "University of Washington Athletics" }),
    true,
    "Huskies staff @uw.edu matches athletics org"
  );
  assert.equal(
    emailDomainMatchesOrg("gonzaga.edu", "gozags.com", { name: "Gonzaga University Athletics" }),
    true
  );
  assert.equal(
    emailDomainMatchesOrg("gmail.com", "gohuskies.com", { name: "University of Washington Athletics" }),
    false,
    "personal mailbox stays risky"
  );
  assert.equal(emailDomainMatchesOrg("shrm.org", "conference.shrm.org"), true);
  assert.equal(emailDomainMatchesOrg("agency.io", "shrm.org"), false);
  assert.equal(emailDomainMatchesOrg("soundersfc.com", "soundersfc.com"), true);

  console.log("ok: queue select-contact accepts risky athletics emails; verify matches .edu on university orgs");
}

main();
