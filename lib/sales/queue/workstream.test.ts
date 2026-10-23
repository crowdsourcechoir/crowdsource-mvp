import assert from "node:assert/strict";
import {
  countQueueWorkstreams,
  matchesQueueWorkstream,
  parseQueueWorkstream,
} from "./workstream";

function main() {
  assert.equal(parseQueueWorkstream(null), "all");
  assert.equal(parseQueueWorkstream("premium"), "premium");
  assert.equal(parseQueueWorkstream("nope"), "all");

  assert.equal(
    matchesQueueWorkstream({ revenueEngine: "owned" }, "owned"),
    true
  );
  assert.equal(
    matchesQueueWorkstream({ organizationTypeKey: "event_agency" }, "sponsor"),
    true
  );
  assert.equal(
    matchesQueueWorkstream({ workstream: "premium", revenueEngine: "owned" }, "premium"),
    true
  );

  const counts = countQueueWorkstreams([
    { revenueEngine: "premium" },
    { salesInitiative: "sports_fan_culture" },
    { organizationTypeKey: "event_agency" },
    { flagshipOffer: "song_garden" },
  ]);
  assert.equal(counts.all, 4);
  assert.equal(counts.premium, 1);
  assert.equal(counts.partnership, 1);
  assert.equal(counts.sponsor, 1);
  assert.equal(counts.owned, 1);

  console.log("workstream.test.ts: ok");
}

main();
