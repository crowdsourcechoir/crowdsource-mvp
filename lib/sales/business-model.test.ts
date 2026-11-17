import assert from "node:assert/strict";
import {
  classifyBusinessCategory,
  classifyDealType,
  classifyProductExperience,
  isHighValueOpportunity,
  resolveBusinessModelFromMetadata,
  withProductExperience,
} from "./business-model";

function main() {
  assert.equal(
    classifyProductExperience({ flagshipOffer: "anthem_experience" }),
    "anthem"
  );
  assert.equal(
    classifyProductExperience({ flagshipOffer: "crowdsource_partnership" }),
    "fan_chant"
  );
  assert.equal(classifyProductExperience({ flagshipOffer: "song_garden" }), "song_garden");
  assert.equal(classifyProductExperience({ salesInitiative: "sports_fan_culture" }), "fan_chant");
  assert.equal(classifyProductExperience({ category: "booking_agents" }), "custom_activation");
  assert.equal(classifyProductExperience({ workstream: "owned" }), "rave_choir");
  assert.equal(
    classifyProductExperience({ opportunityTitle: "Holiday Rave Choir Seattle" }),
    "rave_choir"
  );

  assert.equal(classifyBusinessCategory({ flagshipOffer: "anthem_experience" }), "commissioned");
  assert.equal(classifyBusinessCategory({ workstream: "owned" }), "owned");
  assert.equal(classifyBusinessCategory({ productExperience: "rave_choir" }), "owned");

  assert.equal(classifyDealType({ salesInitiative: "sponsor_partners" }), "sponsorship");
  assert.equal(classifyDealType({ organizationTypeKey: "venue" }), "venue_partnership");
  assert.equal(classifyDealType({ category: "booking_agents" }), "production_partnership");
  assert.equal(classifyDealType({ category: "conferences" }), "client_booking");

  const derived = resolveBusinessModelFromMetadata(
    { revenueEngine: "premium", potentialAmount: 25000 },
    { salesInitiative: "conferences_associations" },
    { category: "conferences", organizationTypeKey: "conference" }
  );
  assert.equal(derived.businessCategory, "commissioned");
  assert.equal(derived.productExperience, "anthem");
  assert.equal(derived.dealType, "client_booking");

  const overridden = resolveBusinessModelFromMetadata(
    { productExperience: "fan_chant", dealType: "strategic_partnership", editionBloom: "Season chant" },
    null,
    { category: "conferences" }
  );
  assert.equal(overridden.productExperience, "fan_chant");
  assert.equal(overridden.dealType, "strategic_partnership");
  assert.equal(overridden.editionBloom, "Season chant");

  const meta = withProductExperience({}, "anthem");
  assert.equal(meta.productExperience, "anthem");
  assert.equal(meta.businessCategory, "commissioned");
  assert.equal(meta.flagshipOffer, "anthem_experience");
  assert.equal(meta.revenueEngine, "premium");

  assert.equal(isHighValueOpportunity(15000), true);
  assert.equal(isHighValueOpportunity(14999), false);
  assert.equal(isHighValueOpportunity(null), false);

  console.log("business-model tests passed");
}

main();
