import assert from "node:assert/strict";
import {
  countQueueAdded,
  isRecentlyAddedQueueItem,
  latestIsoTimestamp,
  matchesQueueAdded,
  operatorAddedTimestampsFromMeta,
  parseQueueAdded,
  QUEUE_ADDED_LOOKBACK_MS,
  queueItemAddedAt,
  resolveQueueRecentlyAddedAt,
} from "./added";

function main() {
  assert.equal(parseQueueAdded(null), "all");
  assert.equal(parseQueueAdded("new"), "new");
  assert.equal(parseQueueAdded("recent"), "new");
  assert.equal(parseQueueAdded("recently_added"), "new");
  assert.equal(parseQueueAdded("nope"), "all");

  const now = Date.parse("2026-10-12T20:00:00.000Z");
  const within = new Date(now - QUEUE_ADDED_LOOKBACK_MS + 60_000).toISOString(); // just inside 7d
  const midWeek = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const outside = new Date(now - QUEUE_ADDED_LOOKBACK_MS - 60_000).toISOString(); // just outside 7d
  const seedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

  assert.ok(QUEUE_ADDED_LOOKBACK_MS >= 7 * 24 * 60 * 60 * 1000);
  assert.equal(isRecentlyAddedQueueItem(within, now), true);
  assert.equal(isRecentlyAddedQueueItem(midWeek, now), true);
  assert.equal(isRecentlyAddedQueueItem(outside, now), false);
  assert.equal(isRecentlyAddedQueueItem(null, now), false);
  assert.equal(matchesQueueAdded(within, "all", now), true);
  assert.equal(matchesQueueAdded(outside, "all", now), true);
  assert.equal(matchesQueueAdded(within, "new", now), true);
  assert.equal(matchesQueueAdded(outside, "new", now), false);

  assert.equal(latestIsoTimestamp(outside, seedAt, within), seedAt);
  assert.deepEqual(operatorAddedTimestampsFromMeta({
    elevateVibeCreateSeeded: true,
    elevateVibeCreateSeededAt: seedAt,
    amplify2027SeededAt: outside,
    name: "ignore",
  }), [seedAt, outside]);
  assert.equal(resolveQueueRecentlyAddedAt(outside, { elevateVibeCreateSeededAt: seedAt }), seedAt);
  // Seed stamp newer than queue created_at wins.
  assert.equal(resolveQueueRecentlyAddedAt(within, { elevateVibeCreateSeededAt: seedAt }), seedAt);

  // Seed stamp rescues an old queue row for Last 7 days.
  assert.equal(matchesQueueAdded(resolveQueueRecentlyAddedAt(outside, { elevateVibeCreateSeededAt: seedAt }), "new", now), true);

  const counts = countQueueAdded(
    [
      { queueItem: { createdAt: within } },
      { queueItem: { createdAt: outside } },
      { recentlyAddedAt: seedAt, queueItem: { createdAt: outside } },
      { queueItem: { createdAt: within } },
    ],
    now
  );
  assert.equal(counts.all, 4);
  assert.equal(counts.new, 3);
  assert.equal(queueItemAddedAt({ recentlyAddedAt: seedAt, queueItem: { createdAt: outside } }), seedAt);

  console.log("queue/added tests passed");
}

main();
