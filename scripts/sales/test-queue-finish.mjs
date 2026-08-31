/**
 * Leave-queue plan: close leftover drafts, don't send.
 * Run: npx tsx scripts/sales/test-queue-finish.mjs
 */
import assert from "node:assert/strict";
import { planQueueFinish } from "../../lib/sales/queue/finish.ts";

const sounders = planQueueFinish(
  [
    { id: "k", kind: "initial", status: "approved" },
    { id: "a", kind: "initial", status: "approved" },
    { id: "g", kind: "initial", status: "draft" },
    { id: "c", kind: "initial", status: "draft" },
  ],
  "2026-08-20T00:00:00.000Z"
);
assert.deepEqual(sounders.rejectIds, ["g", "c"]);
assert.equal(sounders.alreadySent, true);
assert.equal(sounders.queueStatus, "approved");

const neverSent = planQueueFinish(
  [{ id: "d1", kind: "initial", status: "draft" }],
  null
);
assert.deepEqual(neverSent.rejectIds, ["d1"]);
assert.equal(neverSent.alreadySent, false);
assert.equal(neverSent.queueStatus, "deferred");

const nudgeOpen = planQueueFinish(
  [
    { id: "init", kind: "initial", status: "approved" },
    { id: "nudge", kind: "nudge", status: "draft" },
  ],
  "2026-08-01T00:00:00.000Z"
);
assert.deepEqual(nudgeOpen.rejectIds, []);
assert.equal(nudgeOpen.alreadySent, true);

const allSent = planQueueFinish(
  [{ id: "k", kind: "initial", status: "approved" }],
  "2026-08-20T00:00:00.000Z"
);
assert.deepEqual(allSent.rejectIds, []);
assert.equal(allSent.alreadySent, true);
assert.equal(allSent.queueStatus, "approved");

console.log("queue finish plan ok");
