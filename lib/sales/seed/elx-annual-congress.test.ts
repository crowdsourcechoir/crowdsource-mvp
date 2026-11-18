import assert from "node:assert/strict";
import { isGenericMailboxEmail } from "@/lib/sales/dedupe";
import { ELX_ANNUAL_CONGRESS_SEED } from "./elx-annual-congress";

function main() {
  const seed = ELX_ANNUAL_CONGRESS_SEED;
  assert.equal(seed.name, "Event Leaders Exchange");
  assert.equal(seed.websiteUrl, "https://www.eventleaders.com/");
  assert.equal(seed.locationCity, "Seattle");
  assert.equal(seed.organizationTypeKey, "conference");
  assert.equal(seed.salesInitiative, "conferences_associations");
  assert.equal(seed.opportunityTypeKey, "annual_conference");
  assert.equal(seed.forceManualQueue, true);
  assert.equal(seed.runPipeline, false);
  assert.equal(seed.eventDateEstimate, "2027-08-09");
  assert.equal(seed.eventDateConfidence, "confirmed");
  assert.equal(seed.contacts.length, 1);
  assert.equal(seed.contacts[0]?.email, "administrator@eventleaders.com");
  assert.equal(seed.contacts[0]?.emailVerificationStatus, "valid_format");
  assert.equal(isGenericMailboxEmail(seed.contacts[0]?.email), true);
  assert.match(seed.manualQueueDescription ?? "", /Hyatt Regency Seattle/);
  assert.match(seed.manualQueueDescription ?? "", /Nicola Kastner/);

  console.log("elx-annual-congress tests passed");
}

main();
