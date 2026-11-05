import assert from "node:assert/strict";
import { isQueueListedContact, isSelectableContact, isSendableContact } from "./dedupe";
import type { Contact } from "./types";

function contact(partial: Partial<Contact> & Pick<Contact, "fullName">): Contact {
  return {
    id: partial.id ?? "c1",
    organizationId: "o1",
    fullName: partial.fullName,
    roleTitle: null,
    roleCategory: null,
    outreachPersona: "other",
    email: partial.email ?? null,
    normalizedEmail: partial.email?.toLowerCase() ?? null,
    phone: null,
    linkedinUrl: null,
    source: "manual",
    emailVerificationStatus: partial.emailVerificationStatus ?? "unverified",
    enrichmentStatus: null,
    enrichmentProvider: null,
    enrichmentAttemptedAt: null,
    duplicateOfContactId: partial.duplicateOfContactId ?? null,
    importMetadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function main() {
  const namedNoEmail = contact({ fullName: "Jill Kopecky" });
  assert.equal(isQueueListedContact(namedNoEmail), true, "named person without email still listed");
  assert.equal(isSelectableContact(namedNoEmail), false);
  assert.equal(isSendableContact(namedNoEmail), false);

  const bounce = contact({
    fullName: "Booking Desk",
    email: "info@nestelive.com",
    emailVerificationStatus: "invalid",
  });
  assert.equal(isQueueListedContact(bounce), true, "bounce rows stay visible for Override");
  assert.equal(isSelectableContact(bounce), false);

  const good = contact({
    fullName: "Jill Kopecky",
    email: "jill@example.com",
    emailVerificationStatus: "valid_format",
  });
  assert.equal(isQueueListedContact(good), true);
  assert.equal(isSelectableContact(good), true);

  const dup = contact({
    fullName: "Dup Person",
    email: "dup@example.com",
    duplicateOfContactId: "other",
  });
  assert.equal(isQueueListedContact(dup), false);

  console.log("dedupe.queue-listed tests passed");
}

main();
