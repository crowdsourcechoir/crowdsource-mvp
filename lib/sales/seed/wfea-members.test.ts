import assert from "node:assert/strict";
import {
  WFEA_MEMBERS,
  wfeaOperatorNotes,
  wfeaOpportunityTypeKey,
} from "./wfea-members";
import { isPlausibleEmail } from "@/lib/sales/dedupe";

function main() {
  assert.ok(WFEA_MEMBERS.length >= 80, `expected ~82 members, got ${WFEA_MEMBERS.length}`);

  const sales = WFEA_MEMBERS.filter((m) => m.salesTarget);
  const followUp = WFEA_MEMBERS.filter((m) => m.followUp);
  assert.ok(sales.length >= 40, `expected ~46 sales targets, got ${sales.length}`);
  assert.ok(followUp.length >= 20, `expected ~29 follow-ups, got ${followUp.length}`);

  for (const m of followUp) {
    assert.equal(m.salesTarget, true, `${m.name} followUp requires salesTarget`);
    assert.ok(m.emails.length > 0, `${m.name} followUp requires emails`);
  }

  const names = new Set<string>();
  for (const m of WFEA_MEMBERS) {
    assert.ok(m.name.trim(), "name required");
    assert.ok(!names.has(m.name.toLowerCase()), `duplicate name: ${m.name}`);
    names.add(m.name.toLowerCase());

    for (const email of m.emails) {
      assert.ok(isPlausibleEmail(email), `bad email on ${m.name}: ${email}`);
      assert.ok(!/^email/i.test(email), `OCR email prefix left on ${m.name}: ${email}`);
    }

    assert.ok(
      ["festival", "association", "nonprofit", "other"].includes(m.organizationTypeKey),
      `${m.name} bad type ${m.organizationTypeKey}`
    );

    const notes = wfeaOperatorNotes(m);
    assert.ok(notes.startsWith("WFEA member directory."), `${m.name} notes prefix`);
    assert.match(notes.toLowerCase(), /wfea/, `${m.name} searchable as wfea`);
  }

  assert.equal(wfeaOpportunityTypeKey("festival"), "community_festival");
  assert.equal(wfeaOpportunityTypeKey("association"), "association_convention");
  assert.equal(wfeaOpportunityTypeKey("nonprofit"), "community_festival");
  assert.equal(wfeaOpportunityTypeKey("other"), "other");

  // Vendors stay org-only (not sales targets).
  const medics = WFEA_MEMBERS.find((m) => /adventure medics/i.test(m.name));
  assert.ok(medics, "Adventure Medics present");
  assert.equal(medics!.salesTarget, false);
  assert.equal(medics!.followUp, false);

  const ballard = WFEA_MEMBERS.find((m) => /ballard music/i.test(m.name));
  assert.ok(ballard, "Ballard Music present");
  assert.equal(ballard!.salesTarget, true);
  assert.equal(ballard!.followUp, true);

  console.log("wfea-members tests passed");
}

main();
