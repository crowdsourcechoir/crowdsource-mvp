import assert from "node:assert/strict";
import { classifyQueueCategory } from "@/lib/sales/queue/category";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import { BOOKING_AGENTS_SEEDS } from "./booking-agents";

function main() {
  assert.equal(BOOKING_AGENTS_SEEDS.length, 15, "fifteen booking agencies");

  const names = new Set(BOOKING_AGENTS_SEEDS.map((s) => s.name));
  assert.equal(names.size, 15, "agency names must be unique");

  for (const seed of BOOKING_AGENTS_SEEDS) {
    assert.equal(seed.contacts.length, 3, `${seed.name} needs 3 contacts`);
    assert.ok(seed.websiteUrl, `${seed.name} needs website`);
    assert.equal(seed.organizationTypeKey, "event_agency");
    assert.equal(seed.salesInitiative, "booking_agents");
    assert.equal(seed.opportunityTypeKey, "other");
    assert.equal(seed.forceManualQueue, true);
    assert.equal(seed.runPipeline, false);

    assert.equal(
      classifyQueueCategory({
        salesInitiative: seed.salesInitiative,
        organizationName: seed.name,
        organizationTypeKey: seed.organizationTypeKey,
      }),
      "booking_agents",
      `${seed.name} category`
    );
    assert.equal(
      classifyWorkstream({
        salesInitiative: seed.salesInitiative,
        organizationTypeKey: seed.organizationTypeKey,
        category: "booking_agents",
      }),
      "premium",
      `${seed.name} workstream must be premium (not sponsor)`
    );

    const emails = new Set(seed.contacts.map((c) => c.email.toLowerCase()));
    assert.equal(emails.size, 3, `${seed.name} contacts must be unique emails`);
    for (const c of seed.contacts) {
      assert.ok(c.fullName.includes(" "), `${c.fullName} should be first+last`);
      assert.ok(c.email.includes("@"), `${c.fullName} needs email`);
      assert.ok(c.roleTitle.trim(), `${c.fullName} needs role`);
    }
  }

  assert.equal(
    classifyQueueCategory({ organizationName: "BigSpeak Speakers Bureau" }),
    "booking_agents"
  );
  assert.equal(
    classifyWorkstream({ organizationTypeKey: "event_agency" }),
    "sponsor",
    "untagged event agencies still map to sponsor"
  );

  console.log("booking-agents tests passed");
}

main();
