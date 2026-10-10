import assert from "node:assert/strict";
import { AMPLIFY_CONFERENCES_2027_SEEDS } from "./amplify-conferences-2027";

function main() {
  assert.equal(AMPLIFY_CONFERENCES_2027_SEEDS.length, 7, "seven Amplify conferences");

  const names = AMPLIFY_CONFERENCES_2027_SEEDS.map((s) => s.name);
  assert.deepEqual(names, [
    "Amplify A|E|C",
    "Amplify Informatics",
    "WorkWave AMPLIFY",
    "Amplify Summit 2027",
    "Amplify Conference",
    "Amplify 2027 (Reynolds)",
    "AMPLIFY 2027 (ICSE)",
  ]);

  for (const seed of AMPLIFY_CONFERENCES_2027_SEEDS) {
    assert.equal(seed.contacts.length, 3, `${seed.name} needs 3 contacts`);
    assert.ok(seed.websiteUrl, `${seed.name} needs website`);
    assert.ok(seed.eventDateEstimate, `${seed.name} needs event date`);
    assert.equal(seed.opportunityTypeKey, "annual_conference");
    assert.equal(seed.forceManualQueue, true);
    const emails = new Set(seed.contacts.map((c) => c.email.toLowerCase()));
    assert.equal(emails.size, 3, `${seed.name} contacts must be unique emails`);
    for (const c of seed.contacts) {
      assert.ok(c.fullName.includes(" "), `${c.fullName} should be first+last`);
      assert.ok(c.email.includes("@"), `${c.fullName} needs email`);
      assert.ok(c.roleTitle.trim(), `${c.fullName} needs role`);
    }
  }

  console.log("amplify-conferences-2027 tests passed");
}

main();
