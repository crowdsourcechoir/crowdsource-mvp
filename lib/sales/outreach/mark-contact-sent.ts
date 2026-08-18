import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { getContact, listContactsForOrganization } from "@/lib/sales/db/contacts";
import {
  getOpportunity,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { listDraftsForOpportunity, updateDraftDecision } from "@/lib/sales/db/outreach";
import {
  decideQueueItem,
  getQueueItem,
  setQueueItemOutreachDraft,
} from "@/lib/sales/db/queue";
import { hasVerifiedEmail, looksLikePersonName } from "@/lib/sales/dedupe";
import { addDaysIso, NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { soonestFollowUpIso } from "@/lib/sales/outreach/nudge-due";
import type { OutreachDraft, QueueItemDetail } from "@/lib/sales/types";

function isOpenDraft(draft: OutreachDraft): boolean {
  return draft.status === "draft" || draft.status === "qa_flagged" || draft.status === "qa_passed";
}

function isSentDraft(draft: OutreachDraft): boolean {
  return draft.status === "approved" || draft.status === "approved_with_edits";
}

/**
 * Record that Joel already emailed this contact (Gmail UI, mailto, etc.).
 * Does not send. Stays in Awareness. Schedules a 7-day no-reply nudge.
 */
export async function markContactSent(input: {
  itemId: string;
  contactId: string;
  editedSubject?: string | null;
  editedBody?: string | null;
}): Promise<{ detail: QueueItemDetail; remaining: boolean; nextFollowUpAt: string; alreadySent: boolean }> {
  const item = await getQueueItem(input.itemId);
  if (!item) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  if (item.status !== "pending") {
    const err = new Error("Queue item already decided.");
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) {
    const err = new Error("Opportunity not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const contact = await getContact(input.contactId);
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

  const drafts = await listDraftsForOpportunity(opportunity.id);
  const contactDrafts = drafts.filter((d) => d.kind === "initial" && d.contactId === input.contactId);
  const draft =
    [...contactDrafts].reverse().find((d) => isOpenDraft(d)) ??
    [...contactDrafts].reverse().find((d) => isSentDraft(d)) ??
    null;
  if (!draft) {
    const err = new Error("No draft for this contact to mark sent.");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const activities = await listActivitiesForOpportunity(opportunity.id);
  const alreadySent = activities.some((a) => a.activityType === "sent" && a.contactId === input.contactId);

  if (isOpenDraft(draft)) {
    const contentDiffers = Boolean(
      input.editedSubject != null &&
        input.editedBody != null &&
        (input.editedSubject !== draft.aiSubject || input.editedBody !== draft.aiBody)
    );
    await updateDraftDecision(draft.id, {
      status: contentDiffers ? "approved_with_edits" : "approved",
      editedSubject: contentDiffers ? input.editedSubject : undefined,
      editedBody: contentDiffers ? input.editedBody : undefined,
    });
  }

  const now = new Date().toISOString();
  if (!alreadySent) {
    await createOutreachActivity({
      opportunityId: opportunity.id,
      contactId: input.contactId,
      activityType: "sent",
      occurredAt: now,
      metadata: { kind: "initial", via: "manual_mark_sent", queueItemId: item.id },
    });
  }

  if (!opportunity.relationshipStage) {
    await updateOpportunityRelationshipStage(opportunity.id, "awareness");
  }

  const candidateFollowUp = addDaysIso(now, NUDGE_DUE_AFTER_DAYS);
  const nextFollowUpAt = soonestFollowUpIso(opportunity.nextFollowUpAt, candidateFollowUp);
  await updateOpportunityTouchTimestamps(opportunity.id, {
    lastOutboundAt: now,
    nextFollowUpAt,
  });

  const orgContacts = await listContactsForOrganization(opportunity.organizationId);
  const readyIds = new Set(
    orgContacts
      .filter(
        (c) =>
          looksLikePersonName(c.fullName) &&
          c.email &&
          hasVerifiedEmail(c) &&
          !isOutboundEmailBlocked(c.email)
      )
      .map((c) => c.id)
  );
  const latestDrafts = await listDraftsForOpportunity(opportunity.id);
  const openContactIds = new Set(
    latestDrafts
      .filter(
        (d) =>
          d.kind === "initial" &&
          d.contactId &&
          (d.status === "draft" || d.status === "qa_flagged" || d.status === "qa_passed")
      )
      .map((d) => d.contactId as string)
  );
  const nextDraft = latestDrafts.find(
    (d) =>
      d.kind === "initial" &&
      d.contactId &&
      readyIds.has(d.contactId) &&
      d.id !== draft.id &&
      openContactIds.has(d.contactId)
  );

  const markedCurrent = item.outreachDraftId === draft.id;
  let remaining = item.kind !== "initial" || Boolean(nextDraft) || openContactIds.size > 0;
  if (item.kind === "initial" && nextDraft && markedCurrent) {
    await setQueueItemOutreachDraft(input.itemId, nextDraft.id);
  } else if (item.kind === "initial" && !nextDraft && openContactIds.size === 0) {
    await decideQueueItem(input.itemId, {
      status: "approved",
      decisionNotes: "Marked sent (already emailed).",
      decidedBy: "operator",
    });
    await updateOpportunityStatus(opportunity.id, "approved");
    if (!opportunity.relationshipStage) {
      await updateOpportunityRelationshipStage(opportunity.id, "awareness");
    }
  }

  const refreshed = await getQueueItem(input.itemId);
  const detail = await assembleQueueItemDetailFromQueueItem(refreshed ?? item);
  if (!detail) {
    const err = new Error("Could not reload queue item");
    (err as Error & { status: number }).status = 500;
    throw err;
  }

  return { detail, remaining, nextFollowUpAt, alreadySent };
}
