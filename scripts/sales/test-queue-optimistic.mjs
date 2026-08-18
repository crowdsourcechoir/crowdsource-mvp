/**
 * Regression: slim mark-sent / select-contact payloads used to crash the queue with
 * "Cannot read properties of undefined (reading 'draft')" because old JS did
 * `data.detail.draft` after those APIs stopped returning `detail`.
 *
 * Run: npx tsx scripts/sales/test-queue-optimistic.mjs
 */
import assert from "node:assert/strict";
import {
  applySelectContactResponse,
  applySelectedContact,
  applySentDraft,
  draftFromMutationPayload,
} from "../../lib/sales/queue/optimistic.ts";
import { EXTERNAL_SENT_SUBJECT } from "../../lib/sales/outreach/external-sent.ts";

function oldClientReadDraft(data) {
  const detail = data.detail;
  return detail.draft;
}

function sampleItem(overrides = {}) {
  const draft = {
    id: "draft-a",
    opportunityId: "opp-1",
    contactId: "c-a",
    pipelineRunId: null,
    templateId: null,
    kind: "initial",
    aiSubject: "Hi A",
    aiBody: "Body A",
    editedSubject: null,
    editedBody: null,
    qaFlags: null,
    status: "draft",
    confidenceScore: 0.5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const draftB = { ...draft, id: "draft-b", contactId: "c-b", aiSubject: "Hi B", aiBody: "Body B" };
  return {
    queueItem: {
      id: "q-1",
      opportunityId: "opp-1",
      outreachDraftId: "draft-a",
      prospectScoreId: null,
      kind: "initial",
      duplicateWarning: false,
      status: "pending",
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      deferredUntil: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    opportunity: {
      id: "opp-1",
      organizationId: "org-1",
      opportunityTypeId: null,
      title: "Test",
      eventOrInitiativeName: null,
      description: "",
      status: "ready_for_review",
      targetContactRoleHint: null,
      importMetadata: null,
      relationshipStage: null,
      stageUpdatedAt: null,
      lastOutboundAt: null,
      lastInboundAt: null,
      nextFollowUpAt: null,
      gmailThreadId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    opportunityTypeLabel: null,
    organization: { id: "org-1", name: "Seahawks" },
    organizationTypeLabel: null,
    contact: { id: "c-a", fullName: "Alex", email: "a@example.com" },
    contacts: [
      { id: "c-a", fullName: "Alex", email: "a@example.com" },
      { id: "c-b", fullName: "Blair", email: "b@example.com" },
    ],
    contactDrafts: [draft, draftB],
    score: null,
    brief: null,
    draft,
    findings: [],
    ...overrides,
  };
}

function main() {
  const slim = { remaining: true, nextContactId: "c-b", contactId: "c-a", draft: null };
  let threw = null;
  try {
    oldClientReadDraft(slim);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  assert.equal(threw, "Cannot read properties of undefined (reading 'draft')");
  assert.equal(draftFromMutationPayload(slim), null);
  assert.equal(draftFromMutationPayload(undefined), null);
  assert.equal(draftFromMutationPayload(null), null);
  assert.equal(draftFromMutationPayload({}), null);
  const payloadDraft = { id: "draft-new", contactId: "c-b", status: "draft", aiSubject: "n", aiBody: "n" };
  assert.equal(draftFromMutationPayload({ draft: payloadDraft }).id, "draft-new");
  assert.equal(draftFromMutationPayload({ detail: { draft: payloadDraft } }).id, "draft-new");

  const item = sampleItem();
  const sent = applySentDraft(item, "c-a");
  assert.equal(sent.contactDrafts.find((d) => d.contactId === "c-a").status, "approved");
  assert.equal(sent.opportunity.relationshipStage, "awareness");

  const onlyB = item.contactDrafts.filter((d) => d.contactId === "c-b");
  const noDraftItem = sampleItem({ contactDrafts: onlyB, draft: onlyB[0] });
  const gmailSent = applySentDraft(noDraftItem, "c-a");
  const recorded = gmailSent.contactDrafts.find((d) => d.contactId === "c-a");
  assert.ok(recorded, "Gmail-sent contact with no in-app draft still gets a sent record");
  assert.equal(recorded.status, "approved");
  assert.equal(recorded.aiSubject, EXTERNAL_SENT_SUBJECT);
  assert.equal(gmailSent.contactDrafts.filter((d) => d.contactId === "c-a").length, 1);
  console.log("ok: mark sent without an in-app draft still records Gmail sent");

  const missingContacts = applySelectedContact(sampleItem({ contacts: undefined }), "c-a");
  assert.equal(missingContacts, null);

  const switched = applySelectedContact(item, "c-b");
  assert.equal(switched.contact.id, "c-b");
  assert.equal(switched.draft.id, "draft-b");
  assert.equal(switched.queueItem.outreachDraftId, "draft-b");

  const fromSlim = applySelectContactResponse(sent, slim, "c-b");
  assert.equal(fromSlim.contact.id, "c-b");
  assert.equal(fromSlim.draft.id, "draft-b");

  const fromFull = applySelectContactResponse(item, { detail: switched }, "c-b");
  assert.equal(fromFull.draft.id, "draft-b");

  console.log("ok: queue optimistic helpers do not throw on slim payloads");
}

main();
