import assert from "node:assert/strict";
import {
  addCalendarDays,
  followUpFromDateInput,
  followUpPresetIso,
  formatFollowUpDay,
  isFollowUpDueOnOrBeforeToday,
  isFollowUpOverdue,
  ymdInSalesZone,
} from "./calendar";

async function main() {
  const winter = new Date("2026-01-15T18:00:00.000Z"); // 12:00 CT
  assert.equal(ymdInSalesZone(winter.toISOString()), "2026-01-15");

  const todayIso = followUpPresetIso("today", winter);
  assert.ok(isFollowUpDueOnOrBeforeToday(todayIso, winter));
  assert.equal(isFollowUpOverdue(todayIso, winter), false);

  const tomorrowIso = followUpPresetIso("tomorrow", winter);
  assert.equal(ymdInSalesZone(tomorrowIso), "2026-01-16");
  assert.equal(isFollowUpDueOnOrBeforeToday(tomorrowIso, winter), false);

  const three = followUpPresetIso("in_3_days", winter);
  assert.equal(ymdInSalesZone(three), "2026-01-18");

  const week = followUpPresetIso("next_week", winter);
  assert.equal(ymdInSalesZone(week), "2026-01-22");

  const custom = followUpFromDateInput("2026-02-03");
  assert.ok(custom);
  assert.equal(ymdInSalesZone(custom), "2026-02-03");

  const overdue = new Date("2026-01-10T15:00:00.000Z").toISOString();
  assert.equal(isFollowUpOverdue(overdue, winter), true);
  assert.equal(isFollowUpDueOnOrBeforeToday(overdue, winter), true);

  const jan = addCalendarDays(2026, 1, 31, 1);
  assert.deepEqual(jan, { year: 2026, month: 2, day: 1 });

  assert.ok(formatFollowUpDay("2026-06-01T17:00:00.000Z").includes("1"));

  console.log("follow-up calendar tests passed");
}

void main();
