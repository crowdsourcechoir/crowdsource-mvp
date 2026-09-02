import assert from "node:assert/strict";
import { mapHunterVerifierToContactStatus } from "./verification-map";
import type { HunterVerifierResult } from "./hunter-verifier";
import { contactNeedsHunterVerify } from "../pipeline/stages/verifyContacts";
import { hasVerifiedEmail } from "../dedupe";
import type { Contact } from "../types";

function hunter(partial: Partial<HunterVerifierResult>): HunterVerifierResult {
  return {
    ok: true,
    email: "pat@example.org",
    status: "valid",
    score: 90,
    smtpCheck: true,
    acceptAll: false,
    disposable: false,
    gibberish: false,
    mxRecords: true,
    error: null,
    httpStatus: 200,
    ...partial,
  };
}

function contact(status: Contact["emailVerificationStatus"]): Contact {
  return {
    id: "c1",
    organizationId: "o1",
    fullName: "Pat Lee",
    roleTitle: "Director",
    roleCategory: null,
    outreachPersona: "other",
    email: "pat@example.org",
    normalizedEmail: "pat@example.org",
    phone: null,
    emailVerificationStatus: status,
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: null,
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function main() {
  assert.equal(mapHunterVerifierToContactStatus(hunter({})), "verified_deliverable");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ status: "invalid", smtpCheck: false })), "invalid");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ status: "disposable" })), "invalid");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ status: "accept_all", acceptAll: true })), "risky");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ status: "valid", smtpCheck: true, acceptAll: true })), "risky");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ status: "valid", smtpCheck: false })), "risky");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ status: "unknown" })), "risky");
  assert.equal(mapHunterVerifierToContactStatus(hunter({ ok: false, status: null, error: "nope" })), "unverified");

  assert.equal(hasVerifiedEmail(contact("verified_deliverable")), true);
  assert.equal(hasVerifiedEmail(contact("valid_format")), false);
  assert.equal(hasVerifiedEmail(contact("risky")), false);
  assert.equal(hasVerifiedEmail(contact("invalid")), false);

  assert.equal(contactNeedsHunterVerify(contact("valid_format")), true);
  assert.equal(contactNeedsHunterVerify(contact("unverified")), true);
  assert.equal(contactNeedsHunterVerify(contact("verified_deliverable")), false);
  assert.equal(contactNeedsHunterVerify(contact("invalid")), false);

  console.log("verification-map / queue-bar tests passed");
}

void main();
