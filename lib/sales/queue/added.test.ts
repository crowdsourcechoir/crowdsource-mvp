import assert from "node:assert/strict";
import {
  countQueueAdded,
  isRecentlyAddedQueueItem,
  matchesQueueAdded,
  parseQueueAdded,
  QUEUE_ADDED_LOOKBACK_MS,
} from "./added";

function main() {
  assert.equal(parseQueueAdded(null), "all");
  assert.equal(parseQueueAdded("new"), "new");
  assert.equal(parseQueueAdded("recent"), "new");
  assert.equal(parseQueueAdded("recently_added"), "new");
  assert.equal(parseQueueAdded("nope"), "all");

  const now = Date.parse("2026-10-10T20:00:00.000Z");
  const within = new Date(now - QUEUE_ADDED_LOOKBACK_MS + 60_000).toISOString();
  const outside = new Date(now - QUEUE_ADDED_LOOKBACK_MS - 60_000).toISOString();

  assert.equal(isRecentlyAddedQueueItem(within, now), true);
  assert.equal(isRecentlyAddedQueueItem(outside, now), false);
  assert.equal(isRecentlyAddedQueueItem(null, now), false);
  assert.equal(matchesQueueAdded(within, "all", now), true);
  assert.equal(matchesQueueAdded(outside, "all", now), true);
  assert.equal(matchesQueueAdded(within, "new", now), true);
  assert.equal(matchesQueueAdded(outside, "new", now), false);

  const counts = countQueueAdded(
    [
      { queueItem: { createdAt: within } },
      { queueItem: { createdAt: outside } },
      { queueItem: { createdAt: within } },
    ],
    now
  );
  assert.equal(counts.all, 3);
  assert.equal(counts.new, 2);

  console.log("queue/added tests passed");
}

main();
