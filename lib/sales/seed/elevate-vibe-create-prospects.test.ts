import assert from "node:assert/strict";
import { ELEVATE_VIBE_CREATE_PROSPECTS } from "./elevate-vibe-create-prospects";

function main() {
  assert.equal(ELEVATE_VIBE_CREATE_PROSPECTS.length, 29, "29 prospect conferences");

  const names = ELEVATE_VIBE_CREATE_PROSPECTS.map((s) => s.name);
  assert.equal(new Set(names).size, 29, "org names must be unique");

  for (const seed of ELEVATE_VIBE_CREATE_PROSPECTS) {
    assert.equal(seed.contacts.length, 3, `${seed.name} needs 3 contacts`);
    assert.ok(seed.websiteUrl, `${seed.name} needs website`);
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

  console.log("elevate-vibe-create-prospects tests passed");
}

main();
