import assert from "node:assert/strict";
import {
  ANTHEM_MINIMUM_FEE,
  classifyPricingCategory,
  extractAttendance,
  extractMoneyAmounts,
  fundraiserTierForGoal,
  recommendAnthemPricing,
} from "./framework";

function main() {
  assert.equal(ANTHEM_MINIMUM_FEE, 7_500);
  assert.equal(fundraiserTierForGoal(100_000).fee, 7_500);
  assert.equal(fundraiserTierForGoal(300_000).fee, 10_000);
  assert.equal(fundraiserTierForGoal(750_000).fee, 15_000);
  assert.equal(fundraiserTierForGoal(1_500_000).fee, 20_000);
  assert.equal(fundraiserTierForGoal(3_000_000).fee, 30_000);
  assert.equal(fundraiserTierForGoal(6_000_000).openEnded, true);

  assert.deepEqual(extractMoneyAmounts("raising $1.2M this year"), [1_200_000]);
  assert.equal(extractAttendance("About 1,200 attendees expected"), 1_200);

  assert.equal(
    classifyPricingCategory({
      opportunityTypeKey: "fundraising_gala",
      opportunityTitle: "UNITE Gala",
    }),
    "fundraiser"
  );
  assert.equal(
    classifyPricingCategory({
      opportunityTypeKey: "annual_conference",
      opportunityTitle: "Amplify National",
    }),
    "conference"
  );
  assert.equal(
    classifyPricingCategory({
      opportunityTypeKey: "fan_engagement_initiative",
      organizationName: "Seattle Seahawks",
    }),
    "other"
  );

  const galaMissingGoal = recommendAnthemPricing({
    opportunityTypeKey: "fundraising_gala",
    opportunityTitle: "Spring Gala",
    organizationName: "Kids Foundation",
  });
  assert.equal(galaMissingGoal.suggestedAnthemFee, null);
  assert.equal(galaMissingGoal.pricingCategory, "fundraiser");
  assert.ok(galaMissingGoal.pricingQuestions.length > 0);

  const galaWithGoal = recommendAnthemPricing({
    opportunityTypeKey: "fundraising_gala",
    opportunityTitle: "Spring Gala",
    fundraisingGoalUsd: 600_000,
    fundraisingGoalVerified: true,
  });
  assert.equal(galaWithGoal.suggestedAnthemFee, 15_000);
  assert.equal(galaWithGoal.pricingConfidence, "high");

  const national = recommendAnthemPricing({
    opportunityTypeKey: "annual_conference",
    opportunityTitle: "National Association Annual Conference",
    description: "Established national conference",
  });
  assert.equal(national.suggestedAnthemFee, 15_000);
  assert.equal(national.pricingCategory, "conference");

  console.log("pricing/framework tests passed");
}

main();
