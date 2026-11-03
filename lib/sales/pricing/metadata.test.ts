import assert from "node:assert/strict";
import { withDealEconomics, withDealForecast } from "@/lib/sales/engines";
import { recommendAnthemPricing } from "./framework";
import { compareQuoteToSuggested, readAnthemPricing, withAnthemPricing } from "./metadata";

function main() {
  const rec = recommendAnthemPricing({
    opportunityTypeKey: "annual_conference",
    opportunityTitle: "National Summit",
    description: "national conference",
  });
  let meta = withAnthemPricing({ bookedAmount: 12_000, potentialAmount: 10_000 }, rec);
  meta = withDealEconomics(meta, { bookedAmount: 12_000 });
  meta = withDealForecast(meta, { potentialAmount: 10_000 });

  const pricing = readAnthemPricing(meta);
  assert.equal(pricing.suggestedAnthemFee, 15_000);
  assert.equal(meta.bookedAmount, 12_000);
  assert.equal(meta.potentialAmount, 10_000);

  const gap = compareQuoteToSuggested(meta);
  assert.equal(gap.materialDifference, true);
  assert.equal(gap.bookedAmount, 12_000);

  console.log("pricing/metadata tests passed");
}

main();
