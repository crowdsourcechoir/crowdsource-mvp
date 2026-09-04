import assert from "node:assert/strict";
import { draftCopyForContact } from "./enqueue-manual";
import type { Contact } from "../types";

function contact(partial: Partial<Contact> & Pick<Contact, "fullName" | "email">): Contact {
  return {
    id: "c1",
    organizationId: "o1",
    roleTitle: null,
    roleCategory: null,
    outreachPersona: "other",
    normalizedEmail: partial.email,
    phone: null,
    emailVerificationStatus: "unverified",
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
  const events = draftCopyForContact(
    "Fred Hutch Cancer Center",
    contact({ fullName: "Events Contact", email: "events@fredhutch.org", roleTitle: "General inbox" }),
    { opportunityTypeKey: "fundraising_gala", eventName: "Fred Hutch Gala" }
  );
  assert.match(events.body, /^Hi there,/);
  assert.match(events.body, /Thanks!/);
  assert.doesNotMatch(events.body, /Hi Events/);
  assert.doesNotMatch(events.body, /Thanks, there/);
  assert.match(events.subject, /Fred Hutch/);

  const thomas = draftCopyForContact(
    "Fred Hutch Cancer Center",
    contact({ fullName: "Thomas Sheehan", email: "tsheehan@fredhutch.org", roleTitle: "CISO" }),
    { opportunityTypeKey: "fundraising_gala", eventName: "Fred Hutch Gala" }
  );
  assert.match(thomas.body, /^Hi Thomas,/);
  assert.match(thomas.body, /Thanks, Thomas!/);

  console.log("enqueue-manual inbox draft tests passed");
}

void main();
