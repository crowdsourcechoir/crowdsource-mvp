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
assert.equal(
  classifyInbound({
    from: "Microsoft Outlook",
    snippet: "Delivery has failed to these recipients or groups: tanner@ats.edu Your message couldn't be delivered",
  }),
  "bounce"
);
assert.equal(
  classifyInbound({
    from: "Deneen <deneen@example.org>",
    subject: "Re: Crowdsource Choir",
    snippet: "Hello, Thank you for reaching out to me. I am currently away on parental leave celebrating the birth of my daughter.",
  }),
  "auto"
);
assert.equal(
  classifyInbound({
    snippet: "Your message wasn't delivered to tanner@ats.edu because the address couldn't be found.",
  }),
  "bounce"
);
assert.equal(
  classifyInbound({
    from: "Former staff <person@example.org>",
    subject: "Re: Crowdsource Choir",
    snippet: "He's no longer checking this email address.",
  }),
  "auto"
);
assert.equal(
  classifyInbound({
    snippet: "Dear colleague, I retired from the American Association of Community Colleges (AACC) on June 30.",
  }),
  "auto"
);
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
      id: "s6",
      opportunityId: "opp-6",
      contactId: "c6",
      activityType: "sent",
      occurredAt: "2026-09-02T20:10:00.000Z",
      metadata: { kind: "initial" },
      organizationName: "Association of Theological Schools",
      contactName: "Tanner",
      relationshipStage: "awareness",
    },
    {
      id: "r-bounce",
      opportunityId: "opp-6",
      contactId: "c6",
      activityType: "replied",
      occurredAt: "2026-09-02T20:10:30.000Z",
      metadata: {
        snippet: "Delivery has failed to these recipients or groups: tanner@ats.edu Your message couldn't be delivered",
      },
      organizationName: "Association of Theological Schools",
      contactName: "Tanner",
    },
  ],
  now
);

assert.equal(snapshot.emailsSent, 4);
assert.equal(snapshot.firstTouches, 4);
assert.equal(snapshot.liveReplies, 1);
assert.equal(snapshot.autoReplies, 1);
assert.equal(snapshot.bounces, 2);
assert.equal(snapshot.awaiting, 0);
assert.equal(snapshot.liveReplyRate, 25);
assert.equal(snapshot.bounceRate, 50);
assert.equal(snapshot.recentLiveReplies[0]?.organizationName, "LeadingAge");
assert.ok(snapshot.recentBounces.some((e) => e.organizationName === "NAHQ"));
assert.ok(snapshot.recentBounces.some((e) => e.organizationName === "Association of Theological Schools"));
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
