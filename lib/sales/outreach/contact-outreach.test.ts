import assert from "node:assert/strict";
import { contactOutreachById, opportunityOutreachKind, outreachLabel } from "./contact-outreach";
import type { OutreachActivity } from "../types";

function act(partial: Partial<OutreachActivity> & Pick<OutreachActivity, "id" | "activityType" | "occurredAt">): OutreachActivity {
  return {
    opportunityId: "opp",
    contactId: "c1",
    metadata: null,
    gmailMessageId: null,
    gmailThreadId: null,
    ...partial,
  };
}

async function main() {
  const rows = contactOutreachById([
    act({
      id: "1",
      activityType: "sent",
      occurredAt: "2026-09-01T12:00:00.000Z",
      gmailThreadId: "thread-1",
    }),
    act({
      id: "2",
      activityType: "replied",
      occurredAt: "2026-09-02T12:00:00.000Z",
      gmailThreadId: "thread-1",
      gmailMessageId: "msg-2",
      metadata: { snippet: "Hi Joel, let's talk", replyKind: "live" },
    }),
  ]);
  assert.equal(rows.c1?.sentAt?.startsWith("2026-09-01"), true);
  assert.equal(rows.c1?.repliedAt?.startsWith("2026-09-02"), true);
  assert.equal(rows.c1?.snippet, "Hi Joel, let's talk");
  assert.equal(outreachLabel(rows.c1)?.text, "replied");
  assert.equal(opportunityOutreachKind({ lastInboundAt: "x", lastOutboundAt: "y" }), "replied");
  assert.equal(opportunityOutreachKind({ lastInboundAt: null, lastOutboundAt: "y" }), "sent");
  assert.equal(opportunityOutreachKind({ lastInboundAt: null, lastOutboundAt: null, bounced: true }), "bounced");

  const remapped = contactOutreachById(
    [
      act({
        id: "send-peggy",
        contactId: "peggy",
        activityType: "sent",
        occurredAt: "2026-08-18T20:25:01.000Z",
      }),
      act({
        id: "reply-kyle",
        contactId: "peggy",
        activityType: "replied",
        occurredAt: "2026-09-03T20:40:56.000Z",
        metadata: { fromEmail: "hoob@gonzaga.edu", replyKind: "live", snippet: "Hi Joel, I appreciate the follow up" },
      }),
    ],
    [
      { id: "peggy", fullName: "Peggy Sue Loroz", email: "loroz@gonzaga.edu" },
      { id: "kyle", fullName: "Kyle Hoob", email: "hoob@gonzaga.edu" },
    ]
  );
  assert.equal(remapped.peggy?.sentAt?.startsWith("2026-08-18"), true);
  assert.equal(remapped.peggy?.repliedAt ?? null, null);
  assert.equal(remapped.kyle?.repliedAt?.startsWith("2026-09-03"), true);
  assert.equal(outreachLabel(remapped.kyle)?.text, "replied");

  console.log("contact outreach tests passed");
}

void main();
