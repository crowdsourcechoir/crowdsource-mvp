import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  coerceFollowUpIso,
  detectMeetingReminder,
  meetingReminderWindow,
  parseMeetingReminderProperty,
  shouldHoldNudgeForMeetingReminder,
  textHasSchedulingAsk,
  upsertStoredMeetingReminder,
} from "./meeting-reminder";

const NOW = new Date("2026-11-03T18:00:00.000Z"); // Tue Nov 3, 2026, 10:00am Pacific

function detect(text: string, now: Date = NOW, reference: Date = now) {
  return detectMeetingReminder(text, now, reference);
}

async function main() {
  const endNov = detect("This is interesting. Let's set up a meeting at the end of November.");
  assert.equal(endNov?.date, "2026-11-24");
  assert.equal(endNov?.kind, "meeting");

  const earlyDec = detect("Sounds good — reach back out in early December.");
  assert.equal(earlyDec?.date, "2026-12-02");
  assert.equal(earlyDec?.kind, "reach_out");

  const firstWeek = detect("Circle back the first week of December.");
  assert.equal(firstWeek?.date, "2026-12-02");
  assert.equal(firstWeek?.kind, "reach_out");

  const thanks = detect("Want to jump on a call after Thanksgiving?");
  assert.equal(thanks?.date, "2026-11-30");
  assert.equal(thanks?.kind, "meeting");

  const weekAfter = detect("Let's reconnect the week after Thanksgiving.");
  assert.equal(weekAfter?.date, "2026-11-30");
  assert.equal(weekAfter?.kind, "reach_out");

  const mid = detect("Can we touch base in mid December?");
  assert.equal(mid?.date, "2026-12-15");
  assert.equal(mid?.kind, "reach_out");

  const named = detect("Let's meet on November 20.");
  assert.equal(named?.date, "2026-11-20");
  assert.equal(named?.kind, "meeting");

  const bareMonth = detect("I'll follow up in December.");
  assert.equal(bareMonth?.date, "2026-12-02");
  assert.equal(bareMonth?.kind, "reach_out");

  const nextMonth = detect("Let's set up a call next month.");
  assert.equal(nextMonth?.date, "2026-12-02");
  assert.equal(nextMonth?.kind, "meeting");

  const laterThis = detect("Happy to meet later this month.");
  assert.equal(laterThis?.date, "2026-11-24");
  assert.equal(laterThis?.kind, "meeting");

  const newYear = detect("Let's reconnect after the new year.");
  assert.equal(newYear?.date, "2027-01-05");
  assert.equal(newYear?.kind, "reach_out");

  const soonest = detect(
    "Let's set up a meeting at the end of November. If that slips, early December works too."
  );
  assert.equal(soonest?.date, "2026-11-24");
  assert.equal(soonest?.kind, "meeting");

  const quoted = detect(
    "Reach back out in early December.\n\nOn Tue, Nov 1, 2026, Joel wrote:\n> Our conference is at the end of November."
  );
  assert.equal(quoted?.date, "2026-12-02");

  const fromOctober = detect("Let's meet at the end of November.", NOW, new Date("2026-10-20T18:00:00.000Z"));
  assert.equal(fromOctober?.date, "2026-11-24");

  const nextOctober = detect("Let's meet at the end of October.");
  assert.equal(nextOctober?.date, "2027-10-22");

  const earlyAugust = detect("Let's meet in early August.", new Date("2026-07-01T18:00:00.000Z"));
  assert.equal(earlyAugust?.date, "2026-08-03");

  assert.equal(detect("Our annual conference is at the end of November."), null);
  assert.equal(detect("I'm out of the office until early December."), null);
  assert.equal(detect("We met at the end of November last year."), null);
  assert.equal(detect("Just checking in, hope you're well."), null);
  assert.equal(detect("end of November"), null);
  assert.equal(detect("The board meeting at the end of November was great."), null);
  assert.equal(textHasSchedulingAsk("Our conference is at the end of November."), false);
  assert.equal(textHasSchedulingAsk("Let's set up a meeting at the end of November."), true);

  const late = new Date("2026-12-10T18:00:00.000Z");
  assert.equal(detect("Reach back out at the end of November.", late, new Date("2026-11-02T18:00:00.000Z")), null);
  assert.equal(detect("Reach back out in early December.", late, new Date("2026-11-01T18:00:00.000Z")), null);
  assert.equal(detect("Reach back out at the end of November.", late, late)?.date, "2027-11-24");

  const held = upsertStoredMeetingReminder(null, {
    date: "2026-12-02",
    kind: "reach_out",
    phrase: "early December",
    gmailMessageId: "msg-1",
    googleEventId: "evt-1",
    contactId: null,
    contactName: "Ada",
  });
  assert.equal(shouldHoldNudgeForMeetingReminder(held, NOW), true);
  const dueMorning = new Date("2026-12-02T16:00:00.000Z");
  assert.equal(shouldHoldNudgeForMeetingReminder(held, dueMorning), true);
  const onDay = coerceFollowUpIso({
    proposedIso: "2026-12-09T18:00:00.000Z",
    importMetadata: held,
    now: dueMorning,
  });
  assert.equal(onDay?.startsWith("2026-12-02"), true);
  assert.equal(shouldHoldNudgeForMeetingReminder(held, late), false);
  const coerced = coerceFollowUpIso({
    proposedIso: "2026-11-03T18:00:00.000Z",
    importMetadata: held,
    now: NOW,
  });
  assert.equal(coerced?.startsWith("2026-12-02"), true);
  assert.equal(
    coerceFollowUpIso({ proposedIso: "2026-11-10T18:00:00.000Z", importMetadata: held, now: late }),
    "2026-11-10T18:00:00.000Z"
  );

  const window = meetingReminderWindow("2026-11-24");
  assert.equal(window?.startAt, "2026-11-24T17:00:00.000Z");
  assert.equal(window?.endAt, "2026-11-24T17:30:00.000Z");

  assert.deepEqual(parseMeetingReminderProperty("11111111-1111-1111-1111-111111111111:2026-12-02"), {
    opportunityId: "11111111-1111-1111-1111-111111111111",
    date: "2026-12-02",
  });
  assert.equal(parseMeetingReminderProperty("nope"), null);

  const gmailSync = readFileSync("lib/sales/gmail/sync.ts", "utf8");
  const calendarSync = readFileSync("lib/sales/calendar/sync.ts", "utf8");
  const nudges = readFileSync("lib/sales/gmail/nudge.ts", "utf8");
  const constants = readFileSync("lib/sales/calendar/constants.ts", "utf8");
  assert.match(gmailSync, /maybeScheduleMeetingReminder/);
  assert.match(gmailSync, /coerceFollowUpIso/);
  assert.match(calendarSync, /backfillMeetingReminders/);
  assert.match(calendarSync, /parseMeetingReminderProperty/);
  assert.match(nudges, /shouldHoldNudgeForMeetingReminder/);
  const decision = readFileSync("app/api/sales/queue/[itemId]/decision/route.ts", "utf8");
  assert.match(decision, /maybeScheduleMeetingReminder/);
  assert.match(decision, /coerceFollowUpIso/);
  assert.match(constants, /CALENDAR_SYNC_NEXT_DAYS = 90/);
  assert.match(constants, /cscMeetingReminder/);

  console.log("meeting-reminder tests ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
