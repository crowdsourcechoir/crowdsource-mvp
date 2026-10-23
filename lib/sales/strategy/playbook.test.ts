import assert from "node:assert/strict";
import {
  classifyWorkstream,
  isQualifiedBuyer,
  qualificationScore,
  workstreamPriority,
} from "./playbook";

function main() {
  assert.equal(classifyWorkstream({ revenueEngine: "owned" }), "owned");
  assert.equal(classifyWorkstream({ salesInitiative: "sports_fan_culture" }), "partnership");
  assert.equal(classifyWorkstream({ category: "conferences" }), "premium");
  assert.equal(classifyWorkstream({ organizationTypeKey: "event_agency" }), "sponsor");
  assert.equal(classifyWorkstream({}), "premium");

  assert.ok(workstreamPriority("premium") > workstreamPriority("owned"));

  assert.equal(
    qualificationScore({
      hasDecisionMaker: true,
      hasEventDate: true,
      hasPotentialAmount: true,
      hasNextStep: false,
    }),
    3
  );
  assert.equal(
    isQualifiedBuyer({
      hasDecisionMaker: true,
      hasEventDate: true,
      hasPotentialAmount: true,
      hasNextStep: false,
    }),
    true
  );
  assert.equal(
    isQualifiedBuyer({
      hasDecisionMaker: true,
      hasEventDate: false,
      hasPotentialAmount: false,
      hasNextStep: false,
    }),
    false
  );

  console.log("playbook.test.ts: ok");
}

main();
