import assert from "node:assert/strict";
import { followUpEventInstants, followUpEventWindow } from "./gmail-event";
import {
  buildCheckInDraft,
  checkInCalendarDescription,
  checkInEventSummary,
  isParkedOpportunity,
  readParkedFollowUp,
  replyDeclinedThisEdition,
} from "./parked";

const ARTIFACT_SNIPPET =
  "Hello Joel. Thank you for your patience. The Event Director and the team, although we love love your unique offering, have decided that we cannot commit to your cost for this year's event.";

const draft = buildCheckInDraft({
  firstName: "Boaz",
  organizationName: "Artifact AI Summit",
  eventName: "Artifact AI Summit 2027",
  eventDateEstimate: "2027-02-12",
  replySnippet: ARTIFACT_SNIPPET,
});

assert.equal(replyDeclinedThisEdition(ARTIFACT_SNIPPET), true);
assert.equal(draft.editionLabel, "Artifact AI Summit 2028");
assert.equal(draft.subject, "Artifact AI Summit 2028");
assert.equal(draft.year, 2028);
assert.match(draft.body, /^Hi Boaz,/);
assert.match(draft.body, /conversation/);
assert.match(draft.body, /cost didn't fit/);
assert.match(draft.body, /Artifact AI Summit 2028/);
assert.match(draft.body, /keeping the door open/);
assert.match(draft.body, /Best,\nJoel$/);
assert.equal(/send this|automated/i.test(draft.body), false);

assert.equal(checkInEventSummary(draft.editionLabel), "Check in — Artifact AI Summit 2028");

const description = checkInCalendarDescription({
  opportunityId: "opp-artifact",
  contactName: "Boaz Artifact",
  contactEmail: "boaz@weareartifact.com",
  editionLabel: draft.editionLabel,
  subject: draft.subject,
  body: draft.body,
});
assert.match(description, /does not send email/);
assert.match(description, /Boaz Artifact · boaz@weareartifact.com/);
assert.match(description, /\/admin\/sales\/opportunities\/opp-artifact/);
assert.match(description, /Subject: Artifact AI Summit 2028/);

const window = followUpEventWindow("2027-03-03T17:00:00.000Z");
assert.equal(window?.start, "2027-03-03T09:00:00");
assert.equal(window?.end, "2027-03-03T09:01:00");
const instants = followUpEventInstants("2027-03-03T17:00:00.000Z");
assert.equal(instants?.startAt, "2027-03-03T17:00:00.000Z");
assert.equal(instants?.endAt, "2027-03-03T17:01:00.000Z");

const summer = followUpEventInstants("2027-07-06T17:00:00.000Z");
assert.equal(summer?.startAt, "2027-07-06T16:00:00.000Z");
assert.equal(Date.parse(summer!.endAt) - Date.parse(summer!.startAt), 60_000);

assert.equal(isParkedOpportunity({ relationshipStage: "interest", importMetadata: null }), false);
assert.equal(isParkedOpportunity({ relationshipStage: "parked", importMetadata: null }), true);
const stored = readParkedFollowUp({
  parkedFollowUp: {
    active: true,
    followUpOn: "2027-03-03",
    previousStage: "interest",
    contactId: "c1",
    contactName: "Boaz Artifact",
    contactEmail: "boaz@weareartifact.com",
    draftId: "d1",
    subject: draft.subject,
    body: draft.body,
    editionLabel: draft.editionLabel,
    calendarDescription: description,
    parkedAt: "2026-11-17T17:00:00.000Z",
  },
});
assert.ok(stored);
assert.equal(isParkedOpportunity({ relationshipStage: "interest", importMetadata: { parkedFollowUp: stored } }), true);

const open = buildCheckInDraft({
  firstName: "Pia",
  organizationName: "Northwind Forum",
  eventName: null,
  eventDateEstimate: null,
  replySnippet: null,
});
assert.equal(open.declinedThisEdition, false);
assert.match(open.body, /Hi Pia,/);
assert.match(open.body, /our conversation/);
assert.equal(/cost didn't fit/.test(open.body), false);

console.log("parked check-in draft ok");
console.log("--- Artifact draft ---");
console.log(draft.subject);
console.log(draft.body);
console.log("--- Calendar ---");
console.log(checkInEventSummary(draft.editionLabel));
console.log(`${window?.start} to ${window?.end} America/Los_Angeles`);
