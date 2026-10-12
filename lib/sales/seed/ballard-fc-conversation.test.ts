import assert from "node:assert/strict";
import {
  BALLARD_FC_FOLLOW_UP_DATE,
  BALLARD_FC_SEED,
  BALLARD_FC_THREAD_MESSAGES,
} from "./ballard-fc-conversation";
import { followUpFromDateInput } from "@/lib/sales/follow-up/calendar";

function main() {
  assert.equal(BALLARD_FC_SEED.name, "Ballard FC");
  assert.equal(BALLARD_FC_SEED.organizationTypeKey, "sports_team");
  assert.equal(BALLARD_FC_SEED.salesInitiative, "sports_fan_culture");
  assert.equal(BALLARD_FC_SEED.forceManualQueue, true);
  assert.equal(BALLARD_FC_SEED.contacts.length, 3);

  const sam = BALLARD_FC_SEED.contacts.find((c) => c.fullName === "Sam Zisette");
  assert.ok(sam);
  assert.equal(sam!.email, "sam@goballardfc.com");

  assert.equal(BALLARD_FC_THREAD_MESSAGES.length, 5);
  assert.equal(BALLARD_FC_THREAD_MESSAGES.filter((m) => m.direction === "outbound").length, 3);
  assert.equal(BALLARD_FC_THREAD_MESSAGES.filter((m) => m.direction === "inbound").length, 2);

  const followUp = followUpFromDateInput(BALLARD_FC_FOLLOW_UP_DATE);
  assert.ok(followUp);
  assert.ok(followUp!.startsWith("2026-11-12"));

  const emails = new Set(BALLARD_FC_SEED.contacts.map((c) => c.email.toLowerCase()));
  assert.equal(emails.size, 3);

  console.log("ballard-fc-conversation tests passed");
}

main();
