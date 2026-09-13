import assert from "node:assert/strict";
import {
  MAX_HUNTER_CONTACTS_PER_ORG,
  MAX_HUNTER_CREDITS_PER_ORG,
  countHunterSourcedContacts,
  hunterContactSlotsRemaining,
  hunterCreditsSpentOnOrg,
  hunterPersonRank,
  pickTopHunterPeople,
  withHunterCreditsSpent,
} from "./hunter-org-budget";
import type { Contact, Organization } from "@/lib/sales/types";

assert.equal(MAX_HUNTER_CONTACTS_PER_ORG, 3);
assert.equal(MAX_HUNTER_CREDITS_PER_ORG, 3);

const hunter = {
  id: "1",
  source: "ai_discovered",
  importMetadata: { hunterDomainSearch: true, hunterQuery: "events" },
} as unknown as Contact;
const manual = {
  id: "2",
  source: "manual",
  importMetadata: null,
} as unknown as Contact;

assert.equal(countHunterSourcedContacts([hunter, hunter, manual]), 2);
assert.equal(hunterContactSlotsRemaining([hunter, hunter, hunter]), 0);
assert.equal(hunterContactSlotsRemaining([hunter]), 2);

const org = {
  id: "o",
  name: "X",
  importMetadata: { hunterCreditsSpent: 2.5 },
} as unknown as Organization;
assert.equal(hunterCreditsSpentOnOrg(org), 2.5);
assert.equal(withHunterCreditsSpent(org.importMetadata, 0.5).hunterCreditsSpent, 3);

assert.ok(
  hunterPersonRank({ seniority: "executive", position: "CEO" }) >
    hunterPersonRank({ seniority: "junior", position: "Coordinator" })
);
const top = pickTopHunterPeople(
  [
    { seniority: "junior", position: "Coordinator", confidence: 90 },
    { seniority: "executive", position: "VP Events", confidence: 70 },
    { seniority: "senior", position: "Director of Development", confidence: 80 },
    { seniority: "entry", position: "Intern", confidence: 99 },
  ],
  3
);
assert.equal(top.length, 3);
assert.equal(top[0]!.position, "VP Events");
assert.equal(top[1]!.position, "Director of Development");

console.log("hunter-org-budget tests passed");
