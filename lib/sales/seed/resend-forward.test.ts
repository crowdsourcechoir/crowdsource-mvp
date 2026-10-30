import assert from "node:assert/strict";
import { RESEND_FORWARD_SEED } from "./resend-forward";

function main() {
  assert.equal(RESEND_FORWARD_SEED.name, "Resend Forward");
  assert.equal(RESEND_FORWARD_SEED.websiteUrl, "https://resend.com/forward");
  assert.equal(RESEND_FORWARD_SEED.organizationTypeKey, "conference");
  assert.equal(RESEND_FORWARD_SEED.salesInitiative, "conferences_associations");
  assert.equal(RESEND_FORWARD_SEED.opportunityTypeKey, "annual_conference");
  assert.equal(RESEND_FORWARD_SEED.forceManualQueue, true);
  assert.equal(RESEND_FORWARD_SEED.eventDateEstimate, "2026-10-21");
  assert.equal(RESEND_FORWARD_SEED.eventDateConfidence, "confirmed");
  assert.equal(RESEND_FORWARD_SEED.contacts.length, 3);

  const emails = new Set(RESEND_FORWARD_SEED.contacts.map((c) => c.email.toLowerCase()));
  assert.equal(emails.size, 3, "contacts must be unique emails");
  assert.ok(emails.has("christina@resend.com"));
  assert.ok(emails.has("chris@resend.com"));
  assert.ok(emails.has("zeno@resend.com"));

  for (const c of RESEND_FORWARD_SEED.contacts) {
    assert.ok(c.fullName.includes(" "), `${c.fullName} should be first+last`);
    assert.ok(c.email.endsWith("@resend.com"), `${c.fullName} needs resend.com email`);
    assert.ok(c.roleTitle.trim(), `${c.fullName} needs role`);
    assert.equal(c.emailVerificationStatus, "verified_deliverable");
  }

  console.log("resend-forward tests passed");
}

main();
