import assert from "node:assert/strict";
import type { Contact } from "@/lib/sales/types";
import {
  buyerFitHunterRank,
  isNamedPersonalSendableContact,
  isNonBuyerBackOfficeRole,
  isSharedOrPlatformDomain,
  organizationHasOnlyWeakContacts,
} from "./hunter-org-enrich";

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    organizationId: "o1",
    fullName: "Ada Lovelace",
    roleTitle: "Director of Events",
    roleCategory: "events",
    outreachPersona: "events_director",
    email: "ada@northwind.org",
    normalizedEmail: "ada@northwind.org",
    phone: null,
    emailVerificationStatus: "verified_deliverable",
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: null,
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: "2026-11-17T00:00:00.000Z",
    updatedAt: "2026-11-17T00:00:00.000Z",
    ...overrides,
  };
}

function main() {
  assert.equal(isSharedOrPlatformDomain("eventleaders.com"), false);
  assert.equal(isSharedOrPlatformDomain("eudemonia.net"), false);
  assert.equal(isSharedOrPlatformDomain("marriott.com"), true);
  assert.equal(isSharedOrPlatformDomain("coepta.squarespace.com"), true);
  assert.equal(isSharedOrPlatformDomain("seattleschools.org"), true);
  assert.equal(isSharedOrPlatformDomain("gmail.com"), true);

  // Named person with personal email -> strong
  assert.equal(isNamedPersonalSendableContact(makeContact()), true);
  assert.equal(organizationHasOnlyWeakContacts([makeContact()]), false);

  // Generic inbox alone -> weak
  const genericInbox = makeContact({
    fullName: "Administrator inbox",
    email: "administrator@eventleaders.com",
    normalizedEmail: "administrator@eventleaders.com",
  });
  assert.equal(isNamedPersonalSendableContact(genericInbox), false);
  assert.equal(organizationHasOnlyWeakContacts([genericInbox]), true);

  // Named founder attached to generic enquiries@ inbox -> still weak!
  const founderWithGenericEmail = makeContact({
    fullName: "Tim Gray",
    roleTitle: "Founder",
    email: "enquiries@healthoptimisation.com",
    normalizedEmail: "enquiries@healthoptimisation.com",
  });
  assert.equal(isNamedPersonalSendableContact(founderWithGenericEmail), false);
  assert.equal(organizationHasOnlyWeakContacts([founderWithGenericEmail]), true);

  // Back-office filter
  assert.equal(isNonBuyerBackOfficeRole("Accounts Payable Specialist", "finance"), true);
  assert.equal(isNonBuyerBackOfficeRole("IT Helpdesk Technician", "it"), true);
  assert.equal(isNonBuyerBackOfficeRole("VP of Conference Programming", "management"), false);
  assert.equal(isNonBuyerBackOfficeRole("Director of Development & Special Events", "management"), false);

  // Buyer-fit ranking prefers Events Director over Accounting Manager
  const eventsRank = buyerFitHunterRank(
    { position: "Director of Events & Programming", seniority: "director", confidence: 92 },
    { salesInitiative: "conferences_associations" }
  );
  const financeRank = buyerFitHunterRank(
    { position: "Accounting Manager", department: "finance", seniority: "manager", confidence: 95 },
    { salesInitiative: "conferences_associations" }
  );
  assert.ok(eventsRank > financeRank);

  // Fundraising galas prefer Development Director
  const devRank = buyerFitHunterRank(
    { position: "Director of Development", seniority: "director", confidence: 90 },
    { salesInitiative: "fundraising_galas" }
  );
  const genericMgrRank = buyerFitHunterRank(
    { position: "Operations Manager", seniority: "manager", confidence: 90 },
    { salesInitiative: "fundraising_galas" }
  );
  assert.ok(devRank > genericMgrRank);

  console.log("hunter-org-enrich tests passed");
}

main();
