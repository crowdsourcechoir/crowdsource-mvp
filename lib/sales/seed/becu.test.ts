import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BECU_SEED } from "./becu";

function main() {
  assert.equal(BECU_SEED.name, "BECU");
  assert.equal(BECU_SEED.websiteUrl, "https://www.becu.org");
  assert.equal(BECU_SEED.locationCity, "Tukwila");
  assert.equal(BECU_SEED.locationRegion, "WA");
  assert.equal(BECU_SEED.organizationTypeKey, "corporation");
  assert.equal(BECU_SEED.salesInitiative, "sports_fan_culture");
  assert.equal(BECU_SEED.opportunityTypeKey, "fan_engagement_initiative");
  assert.equal(BECU_SEED.forceManualQueue, true);
  assert.equal(BECU_SEED.runPipeline, false);
  assert.equal(BECU_SEED.contacts.length, 3);

  const emails = new Set(BECU_SEED.contacts.map((c) => c.email.toLowerCase()));
  assert.equal(emails.size, 3);
  assert.ok(emails.has("eric.karp@becu.org"));
  assert.ok(emails.has("karin.crane@becu.org"));
  assert.ok(emails.has("teran.evans@becu.org"));

  for (const c of BECU_SEED.contacts) {
    assert.ok(c.fullName.includes(" "), `${c.fullName} should be first+last`);
    assert.ok(c.email.endsWith("@becu.org"));
    assert.ok(/sponsor|partnership|affinity/i.test(c.roleTitle), `${c.fullName} should own partnerships`);
    assert.equal(c.emailVerificationStatus, "verified_deliverable");
  }

  const pipeline = readFileSync(new URL("../../../app/api/sales/cron/pipeline/route.ts", import.meta.url), "utf8");
  assert.match(pipeline, /seedBecu/);
  const vercel = readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8");
  assert.match(vercel, /\/api\/sales\/cron\/seed-becu/);

  console.log("becu tests passed");
}

main();
