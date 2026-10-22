import assert from "node:assert/strict";
import {
  funnelCountsFromStages,
  matchesQueueFunnel,
  parseQueueFunnel,
} from "./funnel";

assert.equal(parseQueueFunnel("won"), "purchase");
assert.equal(parseQueueFunnel("interest"), "interest");
assert.equal(parseQueueFunnel(null), "all");

assert.equal(matchesQueueFunnel(null, "all"), true);
assert.equal(matchesQueueFunnel(null, "awareness"), false, "unsent is not Awareness");
assert.equal(matchesQueueFunnel("interest", "interest"), true);
assert.equal(matchesQueueFunnel("awareness", "interest"), false);

const counts = funnelCountsFromStages({
  awareness: 131,
  interest: 22,
  purchase: 0,
  lost: 3,
});
assert.equal(counts.all, 156);
assert.equal(counts.interest, 22);
assert.equal(counts.awareness, 131);
assert.equal(counts.lost, 3);

console.log("funnel.test.ts: ok");
