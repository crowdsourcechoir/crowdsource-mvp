import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOOST_CONFERENCE_SEED } from "./boost-conference";

function main() {
  assert.equal(BOOST_CONFERENCE_SEED.name, "BOOST Conference");
  assert.equal(BOOST_CONFERENCE_SEED.websiteUrl, "https://www.boostconference.org");
  assert.equal(BOOST_CONFERENCE_SEED.locationCity, "Palm Springs");
  assert.equal(BOOST_CONFERENCE_SEED.locationRegion, "CA");
  assert.equal(BOOST_CONFERENCE_SEED.organizationTypeKey, "conference");
  assert.equal(BOOST_CONFERENCE_SEED.salesInitiative, "conferences_associations");
  assert.equal(BOOST_CONFERENCE_SEED.opportunityTypeKey, "annual_conference");
  assert.equal(BOOST_CONFERENCE_SEED.forceManualQueue, true);
  assert.equal(BOOST_CONFERENCE_SEED.runPipeline, false);
  assert.equal(BOOST_CONFERENCE_SEED.eventDateEstimate, "2027-04-27");
  assert.equal(BOOST_CONFERENCE_SEED.eventDateConfidence, "confirmed");
  assert.equal(BOOST_CONFERENCE_SEED.contacts.length, 3);

  const emails = new Set(BOOST_CONFERENCE_SEED.contacts.map((c) => c.email.toLowerCase()));
  assert.equal(emails.size, 3, "contacts must be unique emails");
  assert.ok(emails.has("chloe@boostcollaborative.org"));
  assert.ok(emails.has("meredith@boostcollaborative.org"));
  assert.ok(emails.has("tia@boostcollaborative.org"));
  assert.equal(emails.has("terri@boostcollaborative.org"), false, "Hunter marked terri@ invalid");

  for (const c of BOOST_CONFERENCE_SEED.contacts) {
    assert.ok(c.fullName.includes(" "), `${c.fullName} should be first+last`);
    assert.ok(c.email.endsWith("@boostcollaborative.org"), `${c.fullName} needs boostcollaborative.org email`);
    assert.ok(c.roleTitle.trim(), `${c.fullName} needs role`);
    assert.equal(c.emailVerificationStatus, "verified_deliverable");
  }

  const pipeline = readFileSync(new URL("../../../app/api/sales/cron/pipeline/route.ts", import.meta.url), "utf8");
  assert.match(pipeline, /seedBoostConference/);
  const vercel = readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8");
  assert.match(vercel, /\/api\/sales\/cron\/seed-boost-conference/);

  console.log("boost-conference tests passed");
}

main();
