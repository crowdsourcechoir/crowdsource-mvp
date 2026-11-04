import assert from "node:assert/strict";
import { classifyQueueCategory } from "@/lib/sales/queue/category";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import { BOOKING_AGENTS_SEEDS } from "./booking-agents";
import { ENTERTAINMENT_BOOKING_AGENCIES_SEEDS } from "./entertainment-booking-agencies";

function main() {
  assert.equal(ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.length, 15, "fifteen entertainment agencies");

  const names = new Set(ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.map((s) => s.name));
  assert.equal(names.size, 15, "agency names must be unique");

  const speakerNames = new Set(BOOKING_AGENTS_SEEDS.map((s) => s.name));
  for (const seed of ENTERTAINMENT_BOOKING_AGENCIES_SEEDS) {
    assert.ok(!speakerNames.has(seed.name), `${seed.name} must not duplicate speaker bureaus`);
    assert.equal(seed.contacts.length, 3, `${seed.name} needs 3 contacts`);
    assert.ok(seed.websiteUrl, `${seed.name} needs website`);
    assert.equal(seed.organizationTypeKey, "event_agency");
    assert.equal(seed.salesInitiative, "booking_agents");
    assert.equal(seed.opportunityTypeKey, "other");
    assert.equal(seed.forceManualQueue, true);
    assert.equal(seed.runPipeline, false);
    assert.ok(
      /entertainment|experiential|talent|booking|producers|eastcoast|neste|opus|jack morton|gpj|george p/i.test(
        seed.manualQueueDescription ?? ""
      ) || /entertainment|experiential|talent buyer|corporate entertainment/i.test(seed.manualQueueTitle ?? ""),
      `${seed.name} copy should signal entertainment (not speaker bureau)`
    );

    assert.equal(
      classifyQueueCategory({
        salesInitiative: seed.salesInitiative,
        organizationName: seed.name,
        organizationTypeKey: seed.organizationTypeKey,
      }),
      "booking_agents"
    );
    assert.equal(
      classifyWorkstream({
        salesInitiative: seed.salesInitiative,
        organizationTypeKey: seed.organizationTypeKey,
        category: "booking_agents",
      }),
      "premium"
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
    classifyQueueCategory({ organizationName: "EastCoast Entertainment" }),
    "booking_agents"
  );

  console.log("entertainment-booking-agencies tests passed");
}

main();
