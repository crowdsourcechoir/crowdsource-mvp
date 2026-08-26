/**
 * Guards that stop the Seahawks same-contact multi-send loop.
 * Run: npx tsx scripts/sales/test-send-guard.mjs
 */
import assert from "node:assert/strict";
import {
  gmailSendsAllowed,
  pickNextRemainingInitialDraft,
  shouldBlockInitialGmailSend,
} from "../../lib/sales/outreach/send-guard.ts";

function draft(overrides = {}) {
  return {
    id: "d1",
    contactId: "c-tyler",
    kind: "initial",
    status: "draft",
    createdAt: "2026-08-15T17:00:00.000Z",
    updatedAt: "2026-08-15T17:00:00.000Z",
    ...overrides,
  };
}

function main() {
  const duplicate = draft({ id: "d-dup", createdAt: "2026-08-15T17:01:00.000Z" });
  const approved = draft({
    id: "d-sent",
    status: "approved",
    createdAt: "2026-08-15T17:00:00.000Z",
    updatedAt: "2026-08-15T17:05:00.000Z",
  });

  const alreadySent = shouldBlockInitialGmailSend({
    itemKind: "initial",
    draft: duplicate,
    activities: [
      {
        activityType: "sent",
        contactId: "c-tyler",
        occurredAt: "2026-08-15T17:05:00.000Z",
        metadata: { kind: "initial" },
      },
    ],
    siblingDrafts: [approved, duplicate],
  });
  assert.equal(alreadySent.blocked, true, "duplicate draft after a send must block");

  const remint = draft({
    id: "d-remint",
    createdAt: "2026-08-15T20:30:00.000Z",
    updatedAt: "2026-08-15T20:30:00.000Z",
  });
  const remintOk = shouldBlockInitialGmailSend({
    itemKind: "initial",
    draft: remint,
    activities: [
      {
        activityType: "sent",
        contactId: "c-tyler",
        occurredAt: "2026-08-15T17:05:00.000Z",
        metadata: { kind: "initial" },
      },
    ],
    siblingDrafts: [approved, remint],
  });
  assert.equal(remintOk.blocked, false, "explicit remint created after the send may go out");

  const sameDraftTwice = shouldBlockInitialGmailSend({
    itemKind: "initial",
    draft: approved,
    activities: [],
    siblingDrafts: [approved],
  });
  assert.equal(sameDraftTwice.blocked, true, "already-approved draft must block");

  const nudge = shouldBlockInitialGmailSend({
    itemKind: "nudge",
    draft: draft({ kind: "nudge" }),
    activities: [
      {
        activityType: "sent",
        contactId: "c-tyler",
        occurredAt: "2026-08-15T17:05:00.000Z",
        metadata: { kind: "initial" },
      },
    ],
    siblingDrafts: [],
  });
  assert.equal(nudge.blocked, false, "in-thread nudges are not the initial-send guard");

  const otherPerson = draft({
    id: "d-blair",
    contactId: "c-blair",
    createdAt: "2026-08-15T17:02:00.000Z",
  });
  const next = pickNextRemainingInitialDraft({
    drafts: [approved, duplicate, otherPerson],
    readyContactIds: new Set(["c-tyler", "c-blair"]),
    justSentDraftId: approved.id,
    justSentContactId: "c-tyler",
  });
  assert.equal(next?.contactId, "c-blair", "remaining must skip the person just emailed");
  assert.notEqual(next?.id, duplicate.id, "remaining must not hop to a duplicate Tyler draft");

  const noOthers = pickNextRemainingInitialDraft({
    drafts: [approved, duplicate],
    readyContactIds: new Set(["c-tyler"]),
    justSentDraftId: approved.id,
    justSentContactId: "c-tyler",
  });
  assert.equal(noOthers, null, "queue should close when only duplicate drafts remain");

  assert.equal(gmailSendsAllowed({ envFlag: undefined, connectionSendsEnabled: false }), false);
  assert.equal(gmailSendsAllowed({ envFlag: "true", connectionSendsEnabled: false }), true);
  assert.equal(gmailSendsAllowed({ envFlag: undefined, connectionSendsEnabled: true }), true);
  assert.equal(gmailSendsAllowed({ envFlag: "false", connectionSendsEnabled: true }), false);
  assert.equal(gmailSendsAllowed({ envFlag: "", connectionSendsEnabled: false }), false);

  console.log("ok: send-guard blocks same-contact duplicates and keeps remint/nudge working");
}

main();
