import assert from "node:assert/strict";
import { shouldShowTodayFollowUp, todayFollowUpReason } from "./today";

async function main() {
  const now = new Date("2026-09-04T18:00:00.000Z");

  assert.equal(shouldShowTodayFollowUp({ hasLiveReply: false, nextFollowUpAt: "2026-08-16T17:00:00.000Z", now }), false);
  assert.equal(shouldShowTodayFollowUp({ hasLiveReply: false, nextFollowUpAt: null, now }), false);
  assert.equal(shouldShowTodayFollowUp({ hasLiveReply: true, nextFollowUpAt: null, now }), true);
  assert.equal(shouldShowTodayFollowUp({ hasLiveReply: true, nextFollowUpAt: "2026-09-04T12:00:00.000Z", now }), true);
  assert.equal(shouldShowTodayFollowUp({ hasLiveReply: true, nextFollowUpAt: "2026-09-11T17:00:00.000Z", now }), false);

  assert.equal(
    todayFollowUpReason({
      hasLiveReply: true,
      inboundAfterSend: true,
      nextFollowUpAt: null,
      now,
    }),
    "replied"
  );
  assert.equal(
    todayFollowUpReason({
      hasLiveReply: true,
      inboundAfterSend: true,
      nextFollowUpAt: "2026-08-20T17:00:00.000Z",
      now,
    }),
    "overdue"
  );

  console.log("today follow-up filter tests passed");
}

void main();
