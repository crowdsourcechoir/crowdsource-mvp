import assert from "node:assert/strict";
import { isGenericMailboxEmail } from "@/lib/sales/dedupe";
import { EUDEMONIA_COMPARABLE_SEEDS } from "./eudemonia-comparables";

function main() {
  assert.equal(EUDEMONIA_COMPARABLE_SEEDS.length, 3);
  const names = EUDEMONIA_COMPARABLE_SEEDS.map((seed) => seed.name);
  assert.deepEqual(names, ["Eudēmonia Summit", "Health Optimisation Summit", "The Longevity Show"]);

  for (const seed of EUDEMONIA_COMPARABLE_SEEDS) {
    assert.equal(seed.organizationTypeKey, "conference");
    assert.equal(seed.salesInitiative, "conferences_associations");
    assert.equal(seed.opportunityTypeKey, "annual_conference");
    assert.equal(seed.forceManualQueue, true);
    assert.equal(seed.runPipeline, false);
    assert.match(seed.eventDateEstimate ?? "", /^2027-/);
    assert.ok(seed.contacts.length >= 1, seed.name);
    for (const contact of seed.contacts) {
      assert.equal(contact.emailVerificationStatus, "valid_format");
      assert.ok(contact.email.includes("@"));
    }
  }

  const eudemonia = EUDEMONIA_COMPARABLE_SEEDS[0]!;
  assert.equal(eudemonia.eventDateEstimate, "2027-11-11");
  assert.equal(eudemonia.contacts[0]?.email, "sean@eudemonia.net");
  assert.equal(isGenericMailboxEmail(eudemonia.contacts[1]?.email), true);
  assert.equal(EUDEMONIA_COMPARABLE_SEEDS[1]?.eventDateEstimate, "2027-04-02");
  assert.equal(EUDEMONIA_COMPARABLE_SEEDS[2]?.eventDateEstimate, "2027-04-16");

  console.log("eudemonia-comparables tests passed");
}

main();
