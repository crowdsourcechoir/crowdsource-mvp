import { listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { listContactsForOrganization, updateContact } from "@/lib/sales/db/contacts";
import {
  getOpportunity,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
} from "@/lib/sales/db/opportunities";
import { listDraftsForOpportunity, updateDraftDecision } from "@/lib/sales/db/outreach";
import { decideQueueItem, getQueueItem, setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { findNextOpenDraft, isOpenInitialDraft } from "@/lib/sales/outreach/remaining-contacts";
import type { OpportunityStatus, RelationshipStage } from "@/lib/sales/types";

function httpError(message: string, status: number): Error {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

export type GraduateQueueResult = {
  remaining: false;
  skippedDrafts: number;
  anySent: boolean;
  opportunityId: string;
  opportunityStatus: OpportunityStatus;
  relationshipStage: RelationshipStage | null;
};

/**
 * Take an org out of the approval queue without emailing leftover contacts.
 * Remaining open drafts are rejected (kept on file, not sent). If anyone was already
 * emailed, the opportunity stays approved and in the funnel; otherwise it is deferred
 * so the pipeline will not put it back in the queue.
 */
export async function graduateQueueItem(input: {
  itemId: string;
  funnelStage?: RelationshipStage | null;
  decidedBy?: string;
  notes?: string | null;
}): Promise<GraduateQueueResult> {
  const item = await getQueueItem(input.itemId);
  if (!item) throw httpError("Not found", 404);
  if (item.status !== "pending") throw httpError("Queue item already decided.", 409);

  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) throw httpError("Opportunity not found", 404);

  const [drafts, activities] = await Promise.all([
    listDraftsForOpportunity(opportunity.id),
    listActivitiesForOpportunity(opportunity.id),
  ]);

  const openDrafts = drafts.filter(isOpenInitialDraft);
  for (const draft of openDrafts) {
    await updateDraftDecision(draft.id, { status: "rejected" });
  }

  const anySent = activities.some((a) => a.activityType === "sent") || Boolean(opportunity.lastOutboundAt);
  const opportunityStatus: OpportunityStatus = anySent ? "approved" : "deferred";
  const queueStatus = anySent ? "approved" : "deferred";
  const notes =
    input.notes ??
    (anySent
      ? "Moved out of queue — remaining contacts skipped (not emailed)."
      : "Moved out of queue without sending. Remaining contacts kept on file.");

  await decideQueueItem(input.itemId, {
    status: queueStatus,
    decisionNotes: notes,
    decidedBy: input.decidedBy ?? "operator",
  });
  await updateOpportunityStatus(opportunity.id, opportunityStatus);

  let relationshipStage = opportunity.relationshipStage;
  const requested = input.funnelStage ?? null;
  if (requested) {
    await updateOpportunityRelationshipStage(opportunity.id, requested);
    relationshipStage = requested;
  } else if (anySent && !relationshipStage) {
    await updateOpportunityRelationshipStage(opportunity.id, "awareness");
    relationshipStage = "awareness";
  }

  return {
    remaining: false,
    skippedDrafts: openDrafts.length,
    anySent,
    opportunityId: opportunity.id,
    opportunityStatus,
    relationshipStage,
  };
}

export type SkipQueueContactResult = {
  remaining: boolean;
  skippedContactId: string;
  nextContactId: string | null;
  nextDraftId: string | null;
  graduated: GraduateQueueResult | null;
};

/**
 * Skip one contact (do not email them). Rejects their open initial drafts.
 * If nobody email-ready is left, graduates the org out of the queue.
 */
export async function skipQueueContact(input: {
  itemId: string;
  contactId: string;
  decidedBy?: string;
}): Promise<SkipQueueContactResult> {
  const item = await getQueueItem(input.itemId);
  if (!item) throw httpError("Not found", 404);
  if (item.status !== "pending") throw httpError("Queue item already decided.", 409);

  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) throw httpError("Opportunity not found", 404);

  const [drafts, contacts] = await Promise.all([
    listDraftsForOpportunity(opportunity.id),
    listContactsForOrganization(opportunity.organizationId),
  ]);

  const openForContact = drafts.filter((d) => isOpenInitialDraft(d) && d.contactId === input.contactId);
  for (const draft of openForContact) {
    await updateDraftDecision(draft.id, { status: "rejected" });
  }

  const skipped = contacts.find((c) => c.id === input.contactId);
  if (skipped && !skipped.duplicateOfContactId) {
    await updateContact(input.contactId, { duplicateOfContactId: skipped.duplicateOfContactId ?? input.contactId });
  }

  const contactsAfter = contacts.map((c) =>
    c.id === input.contactId ? { ...c, duplicateOfContactId: c.duplicateOfContactId ?? c.id } : c
  );
  const draftsAfter = drafts.map((d) =>
    openForContact.some((o) => o.id === d.id) ? { ...d, status: "rejected" as const } : d
  );
  const nextDraft = findNextOpenDraft({
    contacts: contactsAfter,
    drafts: draftsAfter,
    excludeContactId: input.contactId,
  });

  if (nextDraft) {
    if (item.outreachDraftId !== nextDraft.id) {
      await setQueueItemOutreachDraft(input.itemId, nextDraft.id);
    }
    return {
      remaining: true,
      skippedContactId: input.contactId,
      nextContactId: nextDraft.contactId,
      nextDraftId: nextDraft.id,
      graduated: null,
    };
  }

  const graduated = await graduateQueueItem({
    itemId: input.itemId,
    decidedBy: input.decidedBy,
    notes: "Moved out of queue — leftover contacts skipped (not emailed).",
  });
  return {
    remaining: false,
    skippedContactId: input.contactId,
    nextContactId: null,
    nextDraftId: null,
    graduated,
  };
}
