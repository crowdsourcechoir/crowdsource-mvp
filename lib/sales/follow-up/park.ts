import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { getOrganization } from "@/lib/sales/db/organizations";
import {
  getOpportunity,
  updateOpportunityImportMetadata,
  updateOpportunityRelationshipStage,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { createOutreachDraft, getDraft } from "@/lib/sales/db/outreach";
import { createNudgeQueueItem, findPendingNudgeQueueItemId } from "@/lib/sales/db/queue";
import { followUpFromDateInput, ymdInSalesZone } from "@/lib/sales/follow-up/calendar";
import { syncFollowUpCalendarEvent } from "@/lib/sales/follow-up/gmail-event";
import {
  buildCheckInDraft,
  checkInCalendarDescription,
  checkInEventSummary,
  greetingForContact,
  isParkedOpportunity,
  isRelationshipStageConstraintError,
  pickCheckInContact,
  readParkedFollowUp,
  stageAfterUnpark,
  withParkedFollowUp,
  withoutParkedFollowUp,
  type ParkedFollowUpRecord,
} from "@/lib/sales/follow-up/parked";
import type { Opportunity, RelationshipStage } from "@/lib/sales/types";

export type ParkFollowUpResult = {
  opportunity: Opportunity;
  nextFollowUpAt: string | null;
  relationshipStage: RelationshipStage | null;
  stagePersisted: boolean;
  draftId: string;
  subject: string;
  body: string;
  editionLabel: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  calendar: {
    eventId: string | null;
    htmlLink: string | null;
    summary: string;
    warning: string | null;
  };
};

function existingEventId(metadata: Record<string, unknown> | null): string | null {
  return typeof metadata?.followUpCalendarEventId === "string" ? metadata.followUpCalendarEventId : null;
}

function latestReplySnippet(
  activities: Array<{ activityType: string; occurredAt: string; metadata: Record<string, unknown> | null }>
): string | null {
  const reply = activities
    .filter((activity) => activity.activityType === "replied")
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const snippet = reply?.metadata?.snippet;
  if (typeof snippet !== "string" || !snippet.trim()) return null;
  return snippet
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Draft a check-in, put a one-minute calendar reminder on that date, and park the deal.
 * Nothing is emailed. The draft waits until someone queues it and approves the send.
 */
export async function parkFollowUp(opportunityId: string, ymd: string): Promise<ParkFollowUpResult> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");
  const nextFollowUpAt = followUpFromDateInput(ymd);
  if (!nextFollowUpAt) throw new Error("Invalid date");

  const [organization, contacts, activities] = await Promise.all([
    getOrganization(opportunity.organizationId),
    listContactsForOrganization(opportunity.organizationId),
    listActivitiesForOpportunity(opportunity.id).catch(() => []),
  ]);
  if (!organization) throw new Error("Organization missing");

  const picked = pickCheckInContact(contacts, activities);
  const contact =
    (existing ? contacts.find((row) => row.id === existing.contactId && row.email) : null) ?? picked;
  if (!contact?.email) throw new Error("No contact with an email on this deal");

  const existing = readParkedFollowUp(opportunity.importMetadata);
  let draftId = existing?.draftId ?? "";
  let subject = existing?.subject ?? "";
  let body = existing?.body ?? "";
  let editionLabel = existing?.editionLabel ?? "";

  if (!existing) {
    const draftCopy = buildCheckInDraft({
      firstName: greetingForContact(contact),
      organizationName: organization.name,
      eventName: opportunity.eventOrInitiativeName || organization.name,
      eventDateEstimate: opportunity.eventDateEstimate,
      replySnippet: latestReplySnippet(activities),
    });
    const draft = await createOutreachDraft({
      opportunityId: opportunity.id,
      contactId: contact.id,
      kind: "nudge",
      aiSubject: draftCopy.subject,
      aiBody: draftCopy.body,
      status: "draft",
    });
    draftId = draft.id;
    subject = draftCopy.subject;
    body = draftCopy.body;
    editionLabel = draftCopy.editionLabel;
  } else {
    const saved = await getDraft(existing.draftId).catch(() => null);
    if (saved) {
      subject = saved.editedSubject?.trim() || saved.aiSubject;
      body = saved.editedBody?.trim() || saved.aiBody;
    }
  }

  const summary = checkInEventSummary(editionLabel);
  const calendarDescription = checkInCalendarDescription({
    opportunityId: opportunity.id,
    contactName: contact.fullName,
    contactEmail: contact.email,
    editionLabel,
    subject,
    body,
  });

  const synced = await syncFollowUpCalendarEvent({
    opportunityId: opportunity.id,
    organizationName: organization.name,
    organizationId: organization.id,
    whenIso: nextFollowUpAt,
    existingEventId: existingEventId(opportunity.importMetadata),
    summary,
    description: calendarDescription,
    contactName: contact.fullName,
    contactEmail: contact.email,
  });

  const record: ParkedFollowUpRecord = {
    active: true,
    followUpOn: ymdInSalesZone(nextFollowUpAt),
    previousStage:
      opportunity.relationshipStage && opportunity.relationshipStage !== "parked"
        ? opportunity.relationshipStage
        : existing?.previousStage ?? opportunity.relationshipStage,
    contactId: contact.id,
    contactName: contact.fullName,
    contactEmail: contact.email,
    draftId,
    subject,
    body,
    editionLabel,
    calendarDescription,
    parkedAt: existing?.parkedAt ?? new Date().toISOString(),
  };

  let saved = await updateOpportunityImportMetadata(
    opportunity.id,
    withParkedFollowUp(opportunity.importMetadata, record, synced.eventId)
  );
  saved = await updateOpportunityTouchTimestamps(saved.id, { nextFollowUpAt });

  let stagePersisted = saved.relationshipStage === "parked";
  if (!stagePersisted) {
    try {
      saved = await updateOpportunityRelationshipStage(saved.id, "parked");
      stagePersisted = true;
    } catch (err) {
      if (!isRelationshipStageConstraintError(err)) throw err;
      stagePersisted = false;
    }
  }

  if (!existing) {
    await createOutreachActivity({
      opportunityId: opportunity.id,
      contactId: contact.id,
      activityType: "follow_up_due",
      metadata: {
        parked: true,
        manual: true,
        draftId,
        calendarEventId: synced.eventId,
        followUpOn: record.followUpOn,
        sendsEmail: false,
      },
      gmailThreadId: opportunity.gmailThreadId,
    });
  }

  return {
    opportunity: saved,
    nextFollowUpAt: saved.nextFollowUpAt,
    relationshipStage: stagePersisted ? "parked" : saved.relationshipStage,
    stagePersisted,
    draftId,
    subject,
    body,
    editionLabel,
    contactId: contact.id,
    contactName: contact.fullName,
    contactEmail: contact.email,
    calendar: {
      eventId: synced.eventId,
      htmlLink: synced.htmlLink,
      summary,
      warning: synced.warning,
    },
  };
}

/** Drop the reminder and the parked flag. The deal returns to its previous funnel stage. */
export async function returnParkedToPipeline(opportunityId: string): Promise<Opportunity> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");
  const parked = readParkedFollowUp(opportunity.importMetadata);
  const previous = stageAfterUnpark(parked?.previousStage ?? null);
  await syncFollowUpCalendarEvent({
    opportunityId,
    organizationName: parked?.editionLabel || opportunity.title,
    whenIso: null,
    existingEventId: existingEventId(opportunity.importMetadata),
  });
  let saved = await updateOpportunityImportMetadata(opportunity.id, withoutParkedFollowUp(opportunity.importMetadata));
  saved = await updateOpportunityTouchTimestamps(saved.id, { nextFollowUpAt: null });
  if (saved.relationshipStage === "parked" || parked) {
    try {
      saved = await updateOpportunityRelationshipStage(saved.id, previous);
    } catch (err) {
      if (!isRelationshipStageConstraintError(err)) throw err;
    }
  }
  return saved;
}

/** Remove the parked marker and calendar hold without changing the stage the caller just set. */
export async function clearParkedArtifacts(opportunityId: string): Promise<void> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity || !isParkedOpportunity(opportunity)) return;
  await syncFollowUpCalendarEvent({
    opportunityId,
    organizationName: opportunity.title,
    whenIso: null,
    existingEventId: existingEventId(opportunity.importMetadata),
  });
  await updateOpportunityImportMetadata(opportunity.id, withoutParkedFollowUp(opportunity.importMetadata));
}

/** Put the saved check-in into the send queue. Still requires a human Send. */
export async function queueParkedDraft(opportunityId: string): Promise<{ queueItemId: string; draftId: string }> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");
  const parked = readParkedFollowUp(opportunity.importMetadata);
  if (!parked) throw new Error("Park a follow-up before queueing it to send");
  const existing = await findPendingNudgeQueueItemId(opportunity.id, parked.draftId);
  if (existing) return { queueItemId: existing, draftId: parked.draftId };
  const draft = await getDraft(parked.draftId);
  if (!draft) throw new Error("The check-in draft is missing");
  const item = await createNudgeQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: draft.id,
  });
  return { queueItemId: item.id, draftId: draft.id };
}
