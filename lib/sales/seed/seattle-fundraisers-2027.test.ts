import assert from "node:assert/strict";
import { SEATTLE_FUNDRAISERS_2027_SEEDS } from "./seattle-fundraisers-2027";

assert.ok(SEATTLE_FUNDRAISERS_2027_SEEDS.length >= 50, "expected ~55 fundraiser seeds");
assert.ok(
  SEATTLE_FUNDRAISERS_2027_SEEDS.every((s) => s.salesInitiative === "fundraising_galas"),
  "all seeds tagged fundraising_galas"
);
assert.ok(
  SEATTLE_FUNDRAISERS_2027_SEEDS.every((s) => s.opportunityTypeKey === "fundraising_gala"),
  "all seeds are fundraising_gala"
);
assert.ok(
  SEATTLE_FUNDRAISERS_2027_SEEDS.every((s) => s.forceManualQueue === true && s.runPipeline === false),
  "manual queue, no AI pipeline"
);
assert.ok(
  SEATTLE_FUNDRAISERS_2027_SEEDS.every((s) => s.contacts.length >= 1 && s.contacts.length <= 3),
  "1–3 contacts each"
);

const stAnne = SEATTLE_FUNDRAISERS_2027_SEEDS.filter((s) => s.name === "St. Anne School");
assert.equal(stAnne.length, 1, "St. Anne School merged to one org");
assert.match(stAnne[0].manualEventName ?? "", /Gala/i);

const kindering = SEATTLE_FUNDRAISERS_2027_SEEDS.find((s) => s.name === "Kindering");
assert.ok(kindering);
assert.equal(kindering.eventDateEstimate, "2027-02-27");
assert.equal(kindering.eventDateConfidence, "confirmed");

console.log(`seattle-fundraisers-2027.test.ts: ok (${SEATTLE_FUNDRAISERS_2027_SEEDS.length} seeds)`);
