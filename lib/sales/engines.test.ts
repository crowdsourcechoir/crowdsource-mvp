import assert from "node:assert/strict";
import {
  readDealEconomics,
  readDealForecast,
  readFlagshipOffer,
  readRevenueEngine,
  resolveFlagshipOffer,
  resolveRevenueEngine,
  splitPotentialHalves,
  withDealEconomics,
  withDealForecast,
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

  assert.deepEqual(splitPotentialHalves(15000), { first: 7500, second: 7500 });
  assert.deepEqual(splitPotentialHalves(25_000.01), { first: 12500.01, second: 12500 });

  const forecast = withDealForecast(null, {
    potentialAmount: 25000,
    splitHalves: true,
    firstPaymentAt: "2026-11-15",
    secondPaymentAt: "2027-01-10",
  });
  assert.deepEqual(readDealForecast(forecast), {
    potentialAmount: 25000,
    firstPaymentAmount: 12500,
    firstPaymentAt: "2026-11-15",
    secondPaymentAmount: 12500,
    secondPaymentAt: "2027-01-10",
  });

  console.log("engines.test.ts: ok");
}

main();
