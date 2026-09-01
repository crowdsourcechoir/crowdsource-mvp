/**
 * Follow-ups helpers + funnel attention filter.
 * Run: npx tsx scripts/sales/test-follow-ups.mjs
 */
import assert from "node:assert/strict";
import { addDaysIso } from "../../lib/sales/gmail/constants.ts";
import { daysSinceIso, isFirstTouchQueueKind, snoozeUntilIso } from "../../lib/sales/follow-ups.ts";
import {
  countFunnelFocus,
  isNeedsAttentionRow,
  matchesFunnelFocus,
  parseFunnelFocus,
} from "../../lib/sales/funnel-focus.ts";
import { filterFirstTouchSidebarItems } from "../../lib/sales/queue/sidebar.ts";

assert.equal(parseFunnelFocus(null), "attention");
assert.equal(parseFunnelFocus(""), "attention");
assert.equal(parseFunnelFocus("won"), "purchase");
assert.equal(parseFunnelFocus("all"), "all");
assert.equal(parseFunnelFocus("nope"), "attention");

const awaiting = {
  needsNudge: true,
  opportunity: {
    relationshipStage: "awareness",
    lastOutboundAt: "2026-08-20T00:00:00.000Z",
    lastInboundAt: null,
  },
};
const replied = {
  needsNudge: false,
  opportunity: {
    relationshipStage: "interest",
    lastOutboundAt: "2026-08-10T00:00:00.000Z",
    lastInboundAt: "2026-08-12T00:00:00.000Z",
  },
};
const won = {
  needsNudge: false,
  opportunity: {
    relationshipStage: "purchase",
    lastOutboundAt: "2026-07-01T00:00:00.000Z",
    lastInboundAt: "2026-07-03T00:00:00.000Z",
  },
};
const quiet = {
  needsNudge: false,
  opportunity: {
    relationshipStage: "awareness",
    lastOutboundAt: "2026-08-28T00:00:00.000Z",
    lastInboundAt: null,
  },
};

assert.equal(isNeedsAttentionRow(awaiting), true);
assert.equal(isNeedsAttentionRow(replied), true);
assert.equal(isNeedsAttentionRow(won), false);
assert.equal(isNeedsAttentionRow(quiet), false);
assert.equal(matchesFunnelFocus(awaiting, "nudge"), true);
assert.equal(matchesFunnelFocus(quiet, "attention"), false);
assert.equal(matchesFunnelFocus(won, "purchase"), true);
assert.equal(matchesFunnelFocus(won, "attention"), false);

const counts = countFunnelFocus([awaiting, replied, won, quiet]);
assert.equal(counts.attention, 2);
assert.equal(counts.replies, 1);
assert.equal(counts.nudge, 1);
assert.equal(counts.purchase, 1);
assert.equal(counts.all, 4);

assert.equal(daysSinceIso("2026-08-24T15:00:00.000Z", Date.parse("2026-08-31T15:00:00.000Z")), 7);
assert.equal(daysSinceIso(null), null);
assert.equal(snoozeUntilIso(new Date("2026-08-31T15:00:00.000Z"), 7), addDaysIso("2026-08-31T15:00:00.000Z", 7));
assert.equal(snoozeUntilIso(new Date("2026-08-31T15:00:00.000Z"), 7), "2026-09-07T15:00:00.000Z");

assert.equal(isFirstTouchQueueKind("initial"), true);
assert.equal(isFirstTouchQueueKind(null), true);
assert.equal(isFirstTouchQueueKind("nudge"), false);

const filtered = filterFirstTouchSidebarItems([
  { queueItem: { id: "a", kind: "initial" } },
  { queueItem: { id: "b", kind: "nudge" } },
  { queueItem: { id: "c", kind: null } },
]);
assert.deepEqual(
  filtered.map((row) => row.queueItem.id),
  ["a", "c"]
);

console.log("follow-ups + funnel focus ok");
