/**
 * Pure-logic checks for leftover-contact queue graduation.
 * Run: npx --yes tsx scripts/sales/test-remaining-contacts.ts
 */
import {
  findNextOpenDraft,
  isQueueReadyContact,
  remainingOpenDraftCount,
} from "../../lib/sales/outreach/remaining-contacts";
import { buildLearfieldEmail, classifyLearfieldDoorway } from "../../lib/sales/outreach/learfield-voice";
import type { Contact, OutreachDraft } from "../../lib/sales/types";

function contact(partial: Partial<Contact> & { id: string; fullName: string; email: string }): Contact {
  return {
    organizationId: "org",
    roleTitle: "Director",
    roleCategory: "partnerships",
    outreachPersona: "other",
    normalizedEmail: partial.email.toLowerCase(),
    phone: null,
    emailVerificationStatus: "valid_format",
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: null,
    importMetadata: null,
    enrichmentAttemptedAt: null,
    enrichmentProvider: null,
    enrichmentStatus: null,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...partial,
  };
}

function draft(partial: Partial<OutreachDraft> & { id: string; contactId: string; status: OutreachDraft["status"] }): OutreachDraft {
  return {
    opportunityId: "opp",
    pipelineRunId: null,
    templateId: null,
    kind: "initial",
    aiSubject: "s",
    aiBody: "b",
    editedSubject: null,
    editedBody: null,
    qaFlags: null,
    confidenceScore: null,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...partial,
  };
}

let failed = 0;
function assert(name: string, ok: boolean) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${name}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

const kim = contact({
  id: "kim",
  fullName: "Kim Damron",
  email: "kim.damron@learfield.com",
  roleTitle: "President, Sports Properties",
});
const page = contact({
  id: "page",
  fullName: "Page Sanders",
  email: "page.sanders@learfield.com",
  roleTitle: "Vice President of Partnership Management",
});
const hidden = contact({
  id: "hidden",
  fullName: "Skip Me",
  email: "skip@learfield.com",
  duplicateOfContactId: "hidden",
});

assert("ready contact", isQueueReadyContact(kim) === true);
assert("hidden contact is not ready", isQueueReadyContact(hidden) === false);

const drafts = [
  draft({ id: "d1", contactId: "kim", status: "approved" }),
  draft({ id: "d2", contactId: "page", status: "draft" }),
  draft({ id: "d3", contactId: "hidden", status: "draft" }),
];

const next = findNextOpenDraft({ contacts: [kim, page, hidden], drafts, excludeContactId: "kim" });
assert("next open is the visible leftover, not the hidden one", next?.id === "d2");

const stuck = findNextOpenDraft({
  contacts: [kim, hidden],
  drafts: [draft({ id: "d1", contactId: "kim", status: "approved" }), draft({ id: "d3", contactId: "hidden", status: "draft" })],
});
assert("hidden leftover does not keep org in queue", stuck === null);
assert(
  "remaining count ignores hidden",
  remainingOpenDraftCount({
    contacts: [kim, hidden],
    drafts: [draft({ id: "d1", contactId: "kim", status: "approved" }), draft({ id: "d3", contactId: "hidden", status: "draft" })],
  }) === 0
);

assert("sports properties doorway", classifyLearfieldDoorway("President, Sports Properties") === "sports_properties");
assert("partnerships doorway", classifyLearfieldDoorway("Vice President of Partnership Management") === "partnerships");
const email = buildLearfieldEmail({ firstName: "Kim", roleTitle: "President, Sports Properties" });
assert("learfield subject names both products", /game-day moment and Chant Garden/i.test(email.subject));
assert("learfield body sells into campuses", /sell into your campus partners/i.test(email.body));
assert("learfield body mentions chant garden", /Chant Garden/i.test(email.body));

if (failed) {
  console.error(`\n${failed} failing assertion(s)`);
  process.exit(1);
}
console.log("\nall remaining-contact + learfield voice checks passed");
