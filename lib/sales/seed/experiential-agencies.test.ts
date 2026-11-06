import assert from "node:assert/strict";
import { classifyQueueCategory } from "@/lib/sales/queue/category";
import { classifyWorkstream } from "@/lib/sales/strategy/playbook";
import { ENTERTAINMENT_BOOKING_AGENCIES_SEEDS } from "./entertainment-booking-agencies";
import {
  EXPERIENTIAL_AGENCIES_ALREADY_SEEDED,
  EXPERIENTIAL_AGENCIES_SEEDS,
} from "./experiential-agencies";

function main() {
  assert.equal(EXPERIENTIAL_AGENCIES_SEEDS.length, 6, "six net-new experiential agencies");
  assert.equal(EXPERIENTIAL_AGENCIES_ALREADY_SEEDED.length, 1, "GPJ noted as already seeded");
  assert.equal(EXPERIENTIAL_AGENCIES_ALREADY_SEEDED[0].name, "George P. Johnson");

  const names = new Set(EXPERIENTIAL_AGENCIES_SEEDS.map((s) => s.name));
  assert.equal(names.size, 6, "agency names must be unique");

  const entertainmentNames = new Set(ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.map((s) => s.name));
  for (const seed of EXPERIENTIAL_AGENCIES_SEEDS) {
    assert.ok(!entertainmentNames.has(seed.name), `${seed.name} must not duplicate entertainment seed`);
    assert.ok(seed.contacts.length >= 1, `${seed.name} needs at least one contact`);
    assert.ok(seed.websiteUrl, `${seed.name} needs website`);
    assert.equal(seed.organizationTypeKey, "event_agency");
    assert.equal(seed.salesInitiative, "booking_agents");
    assert.equal(seed.opportunityTypeKey, "other");
    assert.equal(seed.forceManualQueue, true);
    assert.equal(seed.runPipeline, false);
    assert.ok(
      /experiential|brand experience|activation|festival|conference|fan/i.test(
        `${seed.manualQueueTitle} ${seed.manualQueueDescription}`
      ),
      `${seed.name} copy should signal experiential fit`
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
    assert.equal(emails.size, seed.contacts.length, `${seed.name} contacts must be unique emails`);
    for (const c of seed.contacts) {
      assert.ok(c.fullName.trim(), `${c.fullName} needs name`);
      assert.ok(c.email.includes("@"), `${c.fullName} needs email`);
      assert.ok(c.roleTitle.trim(), `${c.fullName} needs role`);
      assert.equal(c.emailVerificationStatus, "valid_format");
    }
  }

  assert.ok(
    ENTERTAINMENT_BOOKING_AGENCIES_SEEDS.some((s) => s.name === "George P. Johnson"),
    "GPJ must remain in entertainment seed (duplicate source of truth)"
  );

  console.log("experiential-agencies tests passed");
}

main();
