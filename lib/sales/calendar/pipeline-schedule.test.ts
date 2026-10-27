import assert from "node:assert/strict";
import {
  groupPipelineByDay,
  monthGridDays,
  queueHrefForPipelineEvent,
  shiftMonth,
  shiftWeek,
  weekGridDays,
  type PipelineScheduleEvent,
} from "./pipeline-schedule";

function sample(partial: Partial<PipelineScheduleEvent> & { eventDateEstimate: string }): PipelineScheduleEvent {
  return {
    opportunityId: "opp",
    organizationId: "org",
    organizationName: "Org",
    title: "Title",
    eventDateConfidence: "estimated",
    category: "conferences",
    relationshipStage: "interest",
    queueItemId: "qi",
    potentialAmount: null,
    href: "/admin/sales/queue",
    ...partial,
  };
}

function main() {
  const href = queueHrefForPipelineEvent({
    queueItemId: "abc",
    organizationId: "org1",
    category: "fundraisers",
  });
  assert.ok(href.includes("item=abc"));
  assert.ok(href.includes("category=fundraisers"));
  assert.ok(href.includes("scope=all"));

  const orgOnly = queueHrefForPipelineEvent({
    queueItemId: null,
    organizationId: "org9",
    category: "tech",
  });
  assert.equal(orgOnly, "/admin/sales/organizations/org9");

  const days = monthGridDays(2027, 0); // Jan 2027
  assert.equal(days.length, 42);
  assert.ok(days.includes("2027-01-01"));

  const week = weekGridDays("2027-01-15");
  assert.equal(week.length, 7);
  assert.equal(week[0], "2027-01-11"); // Monday
  assert.equal(week[6], "2027-01-17");

  const next = shiftMonth(2027, 11, 1);
  assert.deepEqual(next, { year: 2028, monthIndex0: 0 });
  assert.equal(shiftWeek("2027-01-11", 1), "2027-01-18");

  const grouped = groupPipelineByDay([
    sample({ eventDateEstimate: "2027-03-01", organizationName: "B" }),
    sample({ eventDateEstimate: "2027-03-01", organizationName: "A", opportunityId: "opp2" }),
    sample({ eventDateEstimate: "2027-03-02", organizationName: "C", opportunityId: "opp3" }),
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].overlap, true);
  assert.equal(grouped[0].events[0].organizationName, "A");
  assert.equal(grouped[1].overlap, false);

  console.log("pipeline-schedule.test.ts: ok");
}

main();
