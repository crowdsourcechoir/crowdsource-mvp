/**
 * Today dashboard funnel classification.
 * Run: npx tsx scripts/sales/test-today-classify.mjs
 */
import assert from "node:assert/strict";
import {
  hasInboundSinceOutbound,
  isAwaitingReply,
  isFollowUpDue,
  isReplyToHandle,
  pickHotLeads,
  summarizeFunnel,
} from "../../lib/sales/today.ts";

const now = Date.parse("2026-08-31T15:00:00.000Z");

const awaiting = {
  id: "a",
  organizationId: "org-a",
  title: "A",
  relationshipStage: "awareness",
  lastOutboundAt: "2026-08-20T00:00:00.000Z",
  lastInboundAt: null,
  nextFollowUpAt: "2026-08-27T00:00:00.000Z",
};
const replied = {
  id: "b",
  organizationId: "org-b",
  title: "B",
  relationshipStage: "interest",
  lastOutboundAt: "2026-08-10T00:00:00.000Z",
  lastInboundAt: "2026-08-12T00:00:00.000Z",
  nextFollowUpAt: "2026-08-17T00:00:00.000Z",
};
const won = {
  id: "c",
  organizationId: "org-c",
  title: "C",
  relationshipStage: "purchase",
  lastOutboundAt: "2026-07-01T00:00:00.000Z",
  lastInboundAt: "2026-07-03T00:00:00.000Z",
  nextFollowUpAt: null,
};
const notDue = {
  ...awaiting,
  id: "d",
  nextFollowUpAt: "2026-09-10T00:00:00.000Z",
};

assert.equal(hasInboundSinceOutbound(replied), true);
assert.equal(hasInboundSinceOutbound(awaiting), false);
assert.equal(isAwaitingReply(awaiting), true);
assert.equal(isAwaitingReply(replied), false);
assert.equal(isAwaitingReply(won), false);
assert.equal(isFollowUpDue(awaiting, now), true);
assert.equal(isFollowUpDue(notDue, now), false);
assert.equal(isFollowUpDue(replied, now), false);
assert.equal(isReplyToHandle(replied), true);
assert.equal(isReplyToHandle(awaiting), false);

const summary = summarizeFunnel([awaiting, replied, won, notDue], now);
assert.equal(summary.won, 1);
assert.equal(summary.replied, 1);
assert.equal(summary.awaitingReply, 2);
assert.equal(summary.followUpsDue, 1);
assert.equal(summary.inFunnel, 4);

const hot = pickHotLeads([awaiting, replied, won], new Map([
  ["org-a", "Awaiting FC"],
  ["org-b", "Replied FC"],
  ["org-c", "Won FC"],
]));
assert.equal(hot[0].organizationName, "Won FC");
assert.equal(hot[1].organizationName, "Replied FC");
assert.equal(hot.length, 2);

console.log("today classify ok");
