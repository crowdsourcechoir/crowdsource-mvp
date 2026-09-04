import assert from "node:assert/strict";
import {
  contactGreetingName,
  genericMailboxLabel,
  hasVerifiedEmail,
  isGenericMailboxEmail,
  isSelectableContact,
  isSendableContact,
  looksLikeGenericRoleName,
  looksLikePersonName,
  thanksSignOff,
} from "./dedupe";
import type { Contact } from "./types";

function contact(partial: Partial<Contact> & Pick<Contact, "fullName" | "email" | "emailVerificationStatus">): Contact {
  return {
    id: "c1",
    organizationId: "o1",
    roleTitle: null,
    roleCategory: null,
    outreachPersona: "other",
    normalizedEmail: partial.email,
    phone: null,
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: null,
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

async function main() {
  assert.equal(looksLikePersonName("Thomas Sheehan"), true);
  assert.equal(looksLikePersonName("Events Contact"), false);
  assert.equal(looksLikePersonName("info@fredhutch.org"), false);
  assert.equal(looksLikeGenericRoleName("Events Contact"), true);

  assert.equal(isGenericMailboxEmail("events@fredhutch.org"), true);
  assert.equal(isGenericMailboxEmail("info@org.org"), true);
  assert.equal(isGenericMailboxEmail("EVENTS+gala@FredHutch.org"), true);
  assert.equal(isGenericMailboxEmail("tsheehan@fredhutch.org"), false);
  assert.equal(genericMailboxLabel("events@fredhutch.org"), "Events inbox");

  const events = contact({
    fullName: "Events Contact",
    email: "events@fredhutch.org",
    emailVerificationStatus: "unverified",
  });
  const thomasUnverified = contact({
    fullName: "Thomas Sheehan",
    email: "tsheehan@fredhutch.org",
    emailVerificationStatus: "unverified",
  });
  const thomasVerified = contact({
    fullName: "Thomas Sheehan",
    email: "tsheehan@fredhutch.org",
    emailVerificationStatus: "verified_deliverable",
  });
  const bouncedInbox = contact({
    fullName: "Info inbox",
    email: "info@fredhutch.org",
    emailVerificationStatus: "invalid",
  });

  assert.equal(isSelectableContact(events), true);
  assert.equal(isSelectableContact(thomasUnverified), true);
  assert.equal(isSendableContact(events), true);
  assert.equal(isSendableContact(thomasUnverified), false);
  assert.equal(isSendableContact(thomasVerified), true);
  assert.equal(isSendableContact(bouncedInbox), false);
  assert.equal(hasVerifiedEmail(events), false);

  assert.equal(contactGreetingName(events), "there");
  assert.equal(contactGreetingName(thomasVerified), "Thomas");
  assert.equal(thanksSignOff("there"), "Thanks!");
  assert.equal(thanksSignOff("Thomas"), "Thanks, Thomas!");

  console.log("dedupe generic-inbox tests passed");
}

void main();
