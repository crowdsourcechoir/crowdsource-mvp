import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { getContact } from "@/lib/sales/db/contacts";
import { getOrganization } from "@/lib/sales/db/organizations";
import {
  getOpportunity,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { listDraftsForOpportunity, updateDraftDecision, createOutreachDraft } from "@/lib/sales/db/outreach";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { addDaysIso, NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import { ensureQueueItemActionable } from "@/lib/sales/outreach/queue-actionable";
import { resolveRemainingAfterSend } from "@/lib/sales/outreach/remaining-contacts";
import { EXTERNAL_SENT_BODY, EXTERNAL_SENT_SUBJECT } from "@/lib/sales/outreach/external-sent";
import { soonestFollowUpIso } from "@/lib/sales/outreach/nudge-due";
import type { OutreachDraft } from "@/lib/sales/types";

function isOpenDraft(draft: OutreachDraft): boolean {
  return draft.status === "draft" || draft.status === "qa_flagged" || draft.status === "qa_passed";
}

function isSentDraft(draft: OutreachDraft): boolean {
  return draft.status === "approved" || draft.status === "approved_with_edits";
}

export type MarkContactSentResult = {
  remaining: boolean;
  nextFollowUpAt: string;
  alreadySent: boolean;
  contactId: string;
  nextContactId: string | null;
  nextDraftId: string | null;
};

/**
 * Record that Joel already emailed this contact (Gmail UI, mailto, etc.).
 * Does not send. A missing in-app draft is fine — Gmail-sent mail still counts.
 * Stays in Awareness. Schedules a 7-day no-reply nudge.
 * Returns a slim payload — callers should not wait on a full queue reassemble.
 */
export async function markContactSent(input: {
  itemId: string;
  contactId: string;
  editedSubject?: string | null;
  editedBody?: string | null;
}): Promise<MarkContactSentResult> {
  const loaded = await getQueueItem(input.itemId);
  if (!loaded) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  const item = await ensureQueueItemActionable(loaded);

  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) {
    const err = new Error("Opportunity not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const [contact, draftsRaw, activitiesRaw] = await Promise.all([
    getContact(input.contactId),
    listDraftsForOpportunity(opportunity.id),
    listActivitiesForOpportunity(opportunity.id),
  ]);
  const drafts = draftsRaw ?? [];
  const activities = activitiesRaw ?? [];

  if (!contact) {
    const err = new Error("Contact not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  if (contact.organizationId !== opportunity.organizationId) {
    const err = new Error("Contact not on this organization");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const contactDrafts = drafts.filter((d) => d.kind === "initial" && d.contactId === input.contactId);
  let draft =
    [...contactDrafts].reverse().find((d) => isOpenDraft(d)) ??
    [...contactDrafts].reverse().find((d) => isSentDraft(d)) ??
    null;

  const alreadySent = activities.some((a) => a.activityType === "sent" && a.contactId === input.contactId);

  const writes: Promise<unknown>[] = [];
  if (!draft) {
    // Gmail / other client already sent — persist a non-sendable approved stub so the card
    // stays green after reload and the 7-day nudge still has a contact to follow.
    draft = await createOutreachDraft({
      opportunityId: opportunity.id,
      contactId: input.contactId,
      kind: "initial",
      status: "approved",
      aiSubject: EXTERNAL_SENT_SUBJECT,
      aiBody: EXTERNAL_SENT_BODY,
      confidenceScore: null,
    });
  } else if (isOpenDraft(draft)) {
    const contentDiffers = Boolean(
      input.editedSubject != null &&
        input.editedBody != null &&
        (input.editedSubject !== draft.aiSubject || input.editedBody !== draft.aiBody)
    );
    writes.push(
      updateDraftDecision(draft.id, {
        status: contentDiffers ? "approved_with_edits" : "approved",
        editedSubject: contentDiffers ? input.editedSubject : undefined,
        editedBody: contentDiffers ? input.editedBody : undefined,
      })
    );
    draft.status = contentDiffers ? "approved_with_edits" : "approved";
  }
  if (!draft) {
    const err = new Error("Could not record sent contact.");
    (err as Error & { status: number }).status = 500;
    throw err;
  }

  const now = new Date().toISOString();
  if (!alreadySent) {
    writes.push(
      createOutreachActivity({
        opportunityId: opportunity.id,
        contactId: input.contactId,
        activityType: "sent",
        occurredAt: now,
        metadata: { kind: "initial", via: "manual_mark_sent", queueItemId: item.id },
      })
    );
  }

  if (!opportunity.relationshipStage) {
    writes.push(updateOpportunityRelationshipStage(opportunity.id, "awareness"));
  }

  const candidateFollowUp = addDaysIso(now, NUDGE_DUE_AFTER_DAYS);
  const nextFollowUpAt = soonestFollowUpIso(opportunity.nextFollowUpAt, candidateFollowUp);
  writes.push(
    updateOpportunityTouchTimestamps(opportunity.id, {
      lastOutboundAt: now,
      nextFollowUpAt,
    })
  );
  await Promise.all(writes);

  const organization = await getOrganization(opportunity.organizationId);
  const afterSend = await resolveRemainingAfterSend({
    item,
    opportunity,
    organization,
    justSentDraftId: draft.id,
    justSentContactId: input.contactId,
  });
  let remaining = item.kind !== "initial" || afterSend.remaining;
  if (item.kind === "initial" && !afterSend.remaining) {
    remaining = false;
    await decideQueueItem(input.itemId, {
      status: "approved",
      decisionNotes: "Marked sent (already emailed).",
      decidedBy: "operator",
    });
    await updateOpportunityStatus(opportunity.id, "approved");
  }

  return {
    remaining,
    nextFollowUpAt,
    alreadySent,
    contactId: input.contactId,
    nextContactId: afterSend.nextDraft?.contactId ?? null,
    nextDraftId: afterSend.nextDraft?.id ?? null,
  };
}
