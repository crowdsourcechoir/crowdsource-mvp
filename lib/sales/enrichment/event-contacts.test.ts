import assert from "node:assert/strict";
import { hunterRecordIsEventContact, isEventRelatedMailbox } from "./event-contacts";
import type { HunterDomainSearchPerson } from "./hunter-domain-search";

function person(partial: Partial<HunterDomainSearchPerson> & Pick<HunterDomainSearchPerson, "email">): HunterDomainSearchPerson {
  return {
    type: "generic",
    confidence: 90,
    firstName: null,
    lastName: null,
    position: null,
    seniority: null,
    department: null,
    linkedin: null,
    phone: null,
    verificationStatus: null,
    ...partial,
  };
}

async function main() {
  assert.equal(isEventRelatedMailbox("events@summit.org"), true);
  assert.equal(isEventRelatedMailbox("community@stormbasketball.com"), true);
  assert.equal(isEventRelatedMailbox("tickets@stormbasketball.com"), true);
  assert.equal(isEventRelatedMailbox("info@websummit.com"), true);
  assert.equal(isEventRelatedMailbox("careers@websummit.com"), false);
  assert.equal(isEventRelatedMailbox("patlee@websummit.com"), false);

  assert.equal(hunterRecordIsEventContact(person({ email: "events@websummit.com" })), true);
  assert.equal(hunterRecordIsEventContact(person({ email: "community@stormbasketball.com" })), true);
  assert.equal(
    hunterRecordIsEventContact(
      person({
        email: "pat@websummit.com",
        type: "personal",
        firstName: "Pat",
        lastName: "Lee",
        position: "Director of Events",
      })
    ),
    true
  );
  assert.equal(
    hunterRecordIsEventContact(
      person({
        email: "sam@websummit.com",
        type: "personal",
        firstName: "Sam",
        lastName: "Kim",
        position: "Director of Information Technology",
        department: "it",
      })
    ),
    false
  );

  console.log("event-contacts filter tests passed");
}

void main();
