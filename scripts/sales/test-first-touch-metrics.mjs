import assert from "node:assert/strict";
import { classifyInbound, failedRecipientsFromBounce, looksLikeAutoReply, looksLikeBounce } from "../../lib/sales/outreach/inbound-kind.ts";
import { buildFirstTouchSnapshot } from "../../lib/sales/outreach/first-touch-metrics.ts";

assert.equal(
  classifyInbound({
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    subject: "Delivery Status Notification (Failure)",
    xFailedRecipients: "ahiller@nahq.org",
  }),
  "bounce"
);
assert.equal(
  classifyInbound({
    from: "Molly Carpenter <mcarpenter@leadingage.org>",
    subject: "Re: Crowdsource Choir for LeadingAge",
    snippet: "Yes, absolutely. We’ve worked with lots of nonprofits",
  }),
  "live"
);
assert.equal(
  classifyInbound({
    from: "Kate Kerley <kkerley@pointsoflight.org>",
    subject: "Automatic reply: Crowdsource Choir",
    snippet: "I am out of the office until Monday.",
  }),
  "auto"
);
assert.equal(looksLikeBounce({ from: "Joel <sing@crowdsourcechoir.com>", subject: "Hello" }), false);
assert.equal(looksLikeAutoReply({ subject: "Out of Office", snippet: "thanks" }), true);
assert.deepEqual(
  failedRecipientsFromBounce({ xFailedRecipients: "bad@example.org" }),
  ["bad@example.org"]
);

const now = Date.parse("2026-09-04T12:00:00.000Z");
const snapshot = buildFirstTouchSnapshot(
  [
    {
      id: "s1",
      opportunityId: "opp-1",
      contactId: "c1",
      activityType: "sent",
      occurredAt: "2026-09-02T12:00:00.000Z",
      metadata: { kind: "initial" },
      organizationName: "LeadingAge",
      contactName: "Molly Carpenter",
      relationshipStage: "interest",
    },
    {
      id: "r1",
      opportunityId: "opp-1",
      contactId: "c1",
      activityType: "replied",
      occurredAt: "2026-09-02T16:00:00.000Z",
      metadata: { snippet: "Yes, absolutely. We’ve worked with lots of nonprofits", replyKind: "live" },
      organizationName: "LeadingAge",
      contactName: "Molly Carpenter",
    },
    {
      id: "s2",
      opportunityId: "opp-2",
      contactId: "c2",
      activityType: "sent",
      occurredAt: "2026-09-01T12:00:00.000Z",
      metadata: { kind: "initial" },
      organizationName: "NAHQ",
      contactName: "Alison Hiller",
      relationshipStage: "awareness",
    },
    {
      id: "b1",
      opportunityId: "opp-2",
      contactId: "c2",
      activityType: "bounced",
      occurredAt: "2026-09-01T12:10:00.000Z",
      metadata: { snippet: "Address not found", failedEmail: "ahiller@nahq.org" },
      organizationName: "NAHQ",
      contactName: "Alison Hiller",
    },
    {
      id: "s3",
      opportunityId: "opp-3",
      contactId: "c3",
      activityType: "sent",
      occurredAt: "2026-09-03T12:00:00.000Z",
      metadata: { kind: "initial" },
      organizationName: "Points of Light",
      contactName: "Kate Kerley",
      relationshipStage: "awareness",
    },
    {
      id: "a1",
      opportunityId: "opp-3",
      contactId: "c3",
      activityType: "replied",
      occurredAt: "2026-09-03T13:00:00.000Z",
      metadata: { snippet: "I am out of the office until Monday.", replyKind: "auto" },
      organizationName: "Points of Light",
      contactName: "Kate Kerley",
    },
    {
      id: "s4",
      opportunityId: "opp-4",
      contactId: "c4",
      activityType: "sent",
      occurredAt: "2026-08-20T12:00:00.000Z",
      metadata: { kind: "nudge" },
      organizationName: "Dance/USA",
      contactName: "Samir",
    },
  ],
  now
);

assert.equal(snapshot.emailsSent, 4);
assert.equal(snapshot.firstTouches, 3);
assert.equal(snapshot.liveReplies, 1);
assert.equal(snapshot.autoReplies, 1);
assert.equal(snapshot.bounces, 1);
assert.equal(snapshot.awaiting, 0);
assert.equal(snapshot.liveReplyRate, 33.3);
assert.equal(snapshot.bounceRate, 33.3);
assert.equal(snapshot.recentLiveReplies[0]?.organizationName, "LeadingAge");
assert.equal(snapshot.recentBounces[0]?.organizationName, "NAHQ");
assert.ok(snapshot.events.some((e) => e.kind === "auto"));

const manualInterest = buildFirstTouchSnapshot(
  [
    {
      id: "s5",
      opportunityId: "opp-5",
      contactId: "c5",
      activityType: "sent",
      occurredAt: "2026-09-02T12:00:00.000Z",
      metadata: { kind: "initial" },
      organizationName: "ATS",
      contactName: "Graham",
      relationshipStage: "interest",
    },
  ],
  now
);
assert.equal(manualInterest.liveReplies, 1);
assert.equal(manualInterest.liveReplyRate, 100);

console.log("first-touch metrics ok");
