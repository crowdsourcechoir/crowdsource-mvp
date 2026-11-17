import assert from "node:assert/strict";
import {
  funnelCountsFromStages,
  matchesQueueFunnel,
  parseQueueFunnel,
} from "./funnel";

assert.equal(parseQueueFunnel("won"), "purchase");
assert.equal(parseQueueFunnel("interest"), "interest");
assert.equal(parseQueueFunnel(null), "all");
assert.equal(parseQueueFunnel("parked"), "parked");

assert.equal(matchesQueueFunnel(null, "all"), true);
assert.equal(matchesQueueFunnel(null, "awareness"), false, "unsent is not Awareness");
assert.equal(matchesQueueFunnel("interest", "interest"), true);
assert.equal(matchesQueueFunnel("awareness", "interest"), false);
assert.equal(matchesQueueFunnel("interest", "all", true), false, "parked leaves the active pipeline");
assert.equal(matchesQueueFunnel("interest", "parked", true), true);
assert.equal(matchesQueueFunnel("parked", "interest"), false);
assert.equal(matchesQueueFunnel("parked", "parked"), true);

const counts = funnelCountsFromStages({
  awareness: 131,
  interest: 22,
  purchase: 0,
  lost: 3,
  parked: 0,
});
assert.equal(counts.all, 156);
assert.equal(counts.interest, 22);
assert.equal(counts.awareness, 131);
assert.equal(counts.lost, 3);
assert.equal(counts.parked, 0);

const withParked = funnelCountsFromStages({
  awareness: 1,
  interest: 2,
  purchase: 0,
  lost: 0,
  parked: 4,
});
assert.equal(withParked.all, 3, "active count leaves parked out");
assert.equal(withParked.parked, 4);

console.log("funnel.test.ts: ok");
