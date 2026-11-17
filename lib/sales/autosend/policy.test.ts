import assert from "node:assert/strict";
import { mergeAutoSendSlots } from "./plan";
import {
  associationBlocksAutoSend,
  autoSendSkipReason,
  classifyAutoSendLane,
  eventDateBand,
  formatPacificWhen,
  isInsideSendWindow,
  pacificClock,
  pacificLocalToIso,
  slotGridIso,
  upcomingBusinessDays,
} from "./policy";
import { daySendReportDue } from "./report";
import type { AutoSendCandidate, AutoSendSlot, AutoSendState } from "./types";

function candidate(id: string, overrides: Partial<AutoSendCandidate> = {}): AutoSendCandidate {
  return {
    queueItemId: id,
    opportunityId: `opp-${id}`,
    organizationId: `org-${id}`,
    organizationName: `Org ${id}`,
    contactName: "Ada Lovelace",
    contactEmail: "ada@example.com",
    subject: "Hello",
    eventTitle: "Annual meeting",
    eventDate: "2027-03-04",
    score: 80,
    lane: "large",
    ...overrides,
  };
}

function baseGate(overrides: Partial<Parameters<typeof autoSendSkipReason>[0]> = {}) {
  return {
    organizationName: "Northwind Summit",
    organizationTypeKey: "corporation",
    doNotProspect: false,
    existingClient: false,
    alreadyContacted: false,
    duplicateWarning: false,
    eventDate: "2027-02-10",
    totalScore: 82,
    audienceScore: 8,
    budgetScore: 7,
    email: "ada@northwind.com",
    emailVerificationStatus: "verified_deliverable",
    personName: true,
    draftOpen: true,
    blockedEmail: false,
    queueKind: "initial",
    queueStatus: "pending",
    ...overrides,
  };
}

function main() {
  const mondayNight = new Date("2026-11-17T04:47:00.000Z");
  const clock = pacificClock(mondayNight);
  assert.equal(clock.ymd, "2026-11-16");
  assert.equal(clock.hour, 20);
  assert.equal(isInsideSendWindow(mondayNight), false);
  assert.deepEqual(upcomingBusinessDays(mondayNight, 2), ["2026-11-17", "2026-11-18"]);

  const tuesdayOpen = new Date("2026-11-17T16:00:00.000Z");
  assert.equal(pacificClock(tuesdayOpen).ymd, "2026-11-17");
  assert.equal(pacificClock(tuesdayOpen).hour, 8);
  assert.equal(isInsideSendWindow(tuesdayOpen), true);

  const grid = slotGridIso("2026-11-17");
  assert.equal(grid.length, 25);
  assert.equal(pacificClock(new Date(grid[0]!)).hour, 8);
  assert.equal(pacificClock(new Date(grid[0]!)).minute, 0);
  const last = pacificClock(new Date(grid[24]!));
  assert.equal(last.hour, 16);
  assert.equal(last.minute, 30);
  assert.match(formatPacificWhen(grid[0]!), /8:00/);

  assert.equal(eventDateBand("2027-01-15", "2026-11-16"), "q1q2_2027");
  assert.equal(eventDateBand("2027-08-02", "2026-11-16"), "q3_2027");
  assert.equal(eventDateBand("2027-11-01", "2026-11-16"), "rolling");
  assert.equal(eventDateBand("2027-05-01", "2026-11-16"), "q1q2_2027");
  assert.equal(eventDateBand("2026-12-01", "2026-11-16"), "excluded");
  assert.equal(eventDateBand(null, "2026-11-16"), "excluded");

  assert.equal(autoSendSkipReason(baseGate(), "2026-11-16"), null);
  assert.match(autoSendSkipReason(baseGate({ organizationName: "Oregon Library Association" }), "2026-11-16") ?? "", /association/);
  assert.match(autoSendSkipReason(baseGate({ organizationTypeKey: "association" }), "2026-11-16") ?? "", /association/);
  assert.match(autoSendSkipReason(baseGate({ audienceScore: 3 }), "2026-11-16") ?? "", /audience/);
  assert.match(autoSendSkipReason(baseGate({ emailVerificationStatus: "risky" }), "2026-11-16") ?? "", /verified/);
  assert.match(autoSendSkipReason(baseGate({ eventDate: null }), "2026-11-16") ?? "", /window/);
  assert.equal(
    classifyAutoSendLane({ organizationName: "Bishop Blanchet High School", eventTitle: "SHINE Gala", opportunityTypeKey: "fundraising_gala" }),
    "other"
  );
  assert.equal(
    classifyAutoSendLane({ organizationName: "The Goodtimes Project", eventTitle: "Goodtimes Gala", opportunityTypeKey: "fundraising_gala" }),
    "other"
  );
  assert.equal(
    classifyAutoSendLane({
      organizationName: "The Goodtimes Project",
      eventTitle: "Goodtimes Gala",
      opportunityTypeKey: "fundraising_gala",
      suggestedFee: 15_000,
    }),
    "large"
  );
  assert.equal(classifyAutoSendLane({ organizationName: "Alaska Airlines", salesInitiative: "sponsor_partners" }), "sponsorship");
  assert.equal(classifyAutoSendLane({ organizationName: "Ballard FC", organizationTypeKey: "sports_team" }), "partnership");
  assert.equal(classifyAutoSendLane({ organizationName: "Harry Walker Agency", organizationTypeKey: "event_agency" }), "partnership");
  assert.equal(classifyAutoSendLane({ organizationName: "Northwind Summit", organizationTypeKey: "corporation" }), "other");
  assert.equal(
    classifyAutoSendLane({
      organizationName: "Amplify Informatics",
      organizationTypeKey: "association",
      opportunityTypeKey: "annual_conference",
      eventTitle: "Amplify Informatics Conference 2027",
    }),
    "large"
  );
  assert.equal(
    autoSendSkipReason(
      baseGate({
        organizationName: "Amplify Informatics",
        organizationTypeKey: "association",
        opportunityTypeKey: "annual_conference",
        eventTitle: "Amplify Informatics Conference 2027",
      }),
      "2026-11-16"
    ),
    null
  );
  assert.equal(
    autoSendSkipReason(
      baseGate({
        organizationName: "Alaska Airlines",
        salesInitiative: "sponsor_partners",
        eventDate: null,
      }),
      "2026-11-16"
    ),
    null
  );
  assert.equal(associationBlocksAutoSend("Oregon Library Association", "association", "large"), true);

  const q3 = candidate("q3", { eventDate: "2027-08-01", score: 99, organizationId: "org-q3" });
  const q1 = Array.from({ length: 3 }, (_, index) =>
    candidate(`q1-${index}`, { eventDate: "2027-02-01", score: 70 + index, organizationId: `org-q1-${index}` })
  );
  const sameOrg = candidate("dup", { organizationId: "org-q1-0", eventDate: "2027-04-01", score: 95 });
  const lined = mergeAutoSendSlots([], [...q1, q3, sameOrg], mondayNight);
  const tomorrow = lined.filter((slot) => slot.day === "2026-11-17");
  assert.equal(tomorrow.length, 4);
  assert.deepEqual(
    tomorrow.map((slot) => slot.queueItemId),
    ["dup", "q1-2", "q1-1", "q3"]
  );
  assert.equal(lined.some((slot) => slot.queueItemId === "q1-0"), false);

  const many = Array.from({ length: 30 }, (_, index) =>
    candidate(`m-${index}`, { organizationId: `org-m-${index}`, score: 90 - (index % 5), eventDate: "2027-03-01" })
  );
  const capped = mergeAutoSendSlots([], many, mondayNight);
  assert.equal(capped.filter((slot) => slot.day === "2026-11-17").length, 18);
  assert.equal(capped.filter((slot) => slot.day === "2026-11-18").length, 12);

  const schools = Array.from({ length: 20 }, (_, index) =>
    candidate(`s-${index}`, {
      lane: "other",
      organizationName: `School ${index}`,
      organizationId: `org-s-${index}`,
      eventTitle: "Annual Auction",
    })
  );
  const larges = Array.from({ length: 4 }, (_, index) =>
    candidate(`l-${index}`, { lane: "large", organizationId: `org-l-${index}`, score: 90 })
  );
  const sponsors = [candidate("sp", { lane: "sponsorship", organizationId: "org-sp", eventDate: "" })];
  const partners = Array.from({ length: 5 }, (_, index) =>
    candidate(`p-${index}`, { lane: "partnership", organizationId: `org-p-${index}` })
  );
  const mixed = mergeAutoSendSlots([], [...schools, ...larges, ...sponsors, ...partners], mondayNight);
  const tuesday = mixed.filter((slot) => slot.day === "2026-11-17");
  assert.equal(tuesday.filter((slot) => slot.lane === "large").length, 4);
  assert.equal(tuesday.filter((slot) => slot.lane === "sponsorship").length, 1);
  assert.equal(tuesday.filter((slot) => slot.lane === "partnership").length, 3);
  assert.equal(tuesday.filter((slot) => slot.lane === "other").length, 2);
  assert.equal(tuesday.length, 10);

  const sentSchools = tuesday
    .filter((slot) => slot.lane === "other")
    .map((slot) => ({ ...slot, status: "sent" as const, sentAt: tuesdayOpen.toISOString() }));
  const afterSchools = mergeAutoSendSlots(sentSchools, [...schools, ...larges], tuesdayOpen);
  const stillToday = afterSchools.filter((slot) => slot.day === "2026-11-17" && slot.status === "queued");
  assert.equal(stillToday.filter((slot) => slot.lane === "other").length, 0);
  assert.equal(stillToday.filter((slot) => slot.lane === "large").length, 4);

  const sent: AutoSendSlot = { ...lined[0]!, status: "sent", sentAt: tuesdayOpen.toISOString() };
  const kept = mergeAutoSendSlots([sent], [], tuesdayOpen);
  assert.equal(kept.some((slot) => slot.queueItemId === sent.queueItemId && slot.status === "sent"), true);

  const state: AutoSendState = {
    enabled: true,
    updatedAt: null,
    slots: capped.filter((slot) => slot.day === "2026-11-17").map((slot) => ({ ...slot, status: "sent" as const, sentAt: slot.scheduledAt })),
    ready: null,
    reports: [],
  };
  assert.equal(daySendReportDue(state, "2026-11-17", false), false);
  assert.equal(daySendReportDue(state, "2026-11-17", true), true);
  assert.equal(daySendReportDue({ ...state, reports: [{ day: "2026-11-17", sentAt: tuesdayOpen.toISOString() }] }, "2026-11-17", true), false);

  console.log("autosend policy tests passed");
}

main();
