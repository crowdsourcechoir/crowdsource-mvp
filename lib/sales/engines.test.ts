import assert from "node:assert/strict";
import {
  readDealEconomics,
  readFlagshipOffer,
  readRevenueEngine,
  resolveFlagshipOffer,
  resolveRevenueEngine,
  withDealEconomics,
  withFlagshipOffer,
  withRevenueEngine,
} from "./engines";

function main() {
  const meta = withRevenueEngine(null, "premium");
  assert.equal(readRevenueEngine(meta), "premium");
  assert.equal(readFlagshipOffer(meta), "anthem_experience");

  const offerMeta = withFlagshipOffer({}, "song_garden");
  assert.equal(readFlagshipOffer(offerMeta), "song_garden");
  assert.equal(readRevenueEngine(offerMeta), "owned");

  const org = withRevenueEngine(null, "partnership");
  const opp = withRevenueEngine(null, "premium");
  assert.equal(resolveRevenueEngine(opp, org), "premium");
  assert.equal(resolveRevenueEngine(null, org), "partnership");
  assert.equal(resolveFlagshipOffer(null, org), "crowdsource_partnership");

  const economics = withDealEconomics(null, {
    bookedAmount: 15000,
    cashCollected: "5,000",
    earnedAmount: null,
  });
  assert.deepEqual(readDealEconomics(economics), {
    bookedAmount: 15000,
    cashCollected: 5000,
    earnedAmount: null,
  });

  const cleared = withRevenueEngine(withRevenueEngine(null, "owned"), null);
  assert.equal(readRevenueEngine(cleared), null);

  console.log("engines.test.ts: ok");
}

main();
