import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { getContact } from "@/lib/sales/db/contacts";
import { getOpportunity, updateOpportunityRelationshipStage, updateOpportunityStatus, updateOpportunityTouchTimestamps } from "@/lib/sales/db/opportunities";
import { claimOpenDraftForSend, getDraft, listDraftsForOpportunity, revertDraftClaim } from "@/lib/sales/db/outreach";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { addDaysIso, NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import { sendGmailMessage } from "@/lib/sales/gmail/send";
import { coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { shouldBlockInitialGmailSend } from "@/lib/sales/outreach/send-guard";
import type { AutoSendSlot } from "./types";

export type SlotSendResult =
  | { result: "sent"; sentAt: string; subject: string }
  | { result: "skipped"; error: string }
  | { result: "retry"; error: string };

/**
 * Send one lined-up first touch from the connected Gmail account and record it
 * the same way a confirmed queue approval does.
 */
export async function sendAutoSendSlot(slot: AutoSendSlot): Promise<SlotSendResult> {
  const item = await getQueueItem(slot.queueItemId);
  if (!item || item.status !== "pending" || item.kind !== "initial") {
    return { result: "skipped", error: "Queue row is no longer waiting to send." };
  }
  const draft = item.outreachDraftId ? await getDraft(item.outreachDraftId) : null;
  if (!draft) return { result: "skipped", error: "Draft is missing." };
  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) return { result: "skipped", error: "Opportunity is missing." };
  if (opportunity.lastOutboundAt || opportunity.gmailThreadId) {
    return { result: "skipped", error: "This organization was already contacted." };
  }

  const contact = draft.contactId ? await getContact(draft.contactId) : null;
  if (!contact?.email) return { result: "skipped", error: "Draft has no contact email." };
  if (isOutboundEmailBlocked(contact.email)) {
    return { result: "skipped", error: `Blocked address ${contact.email}.` };
  }
  if (contact.emailVerificationStatus !== "verified_deliverable") {
    return { result: "skipped", error: "Email is no longer verified." };
  }

  const subject = coalesceDraftSubject(draft.editedSubject, draft.aiSubject).trim();
  const body = coalesceDraftBody(draft.editedBody, draft.aiBody).trim();
  if (!subject || !body) return { result: "skipped", error: "Draft subject or body is empty." };

  const activities = await listActivitiesForOpportunity(opportunity.id);
  const siblingDrafts = await listDraftsForOpportunity(opportunity.id);
  const blocked = shouldBlockInitialGmailSend({
    itemKind: item.kind,
    draft,
    activities,
    siblingDrafts,
  });
  if (blocked.blocked) return { result: "skipped", error: blocked.reason ?? "Send blocked." };

  const claimed = await claimOpenDraftForSend(draft.id, { status: "approved" });
  if (!claimed) return { result: "skipped", error: "Draft was already claimed." };

  let gmailSend: { messageId: string; threadId: string };
  try {
    gmailSend = await sendGmailMessage({ to: contact.email, subject, body });
  } catch (err) {
    await revertDraftClaim(draft.id, draft.status);
    return { result: "retry", error: err instanceof Error ? err.message : "Gmail send failed." };
  }

  const sentAt = new Date().toISOString();
  await decideQueueItem(item.id, {
    status: "approved",
    decidedBy: "autosend",
    decisionNotes: "Sent by the weekday business-hours queue.",
  });
  await updateOpportunityStatus(opportunity.id, "approved");
  if (!opportunity.relationshipStage) {
    await updateOpportunityRelationshipStage(opportunity.id, "awareness");
  }
  await createOutreachActivity({
    opportunityId: opportunity.id,
    contactId: contact.id,
    activityType: "approved",
    occurredAt: sentAt,
    metadata: { queueItemId: item.id, kind: "initial", viaGmail: true, autosend: true },
    gmailThreadId: gmailSend.threadId,
  });
  await createOutreachActivity({
    opportunityId: opportunity.id,
    contactId: contact.id,
    activityType: "sent",
    occurredAt: sentAt,
    metadata: { kind: "initial", queueItemId: item.id, autosend: true },
    gmailMessageId: gmailSend.messageId,
    gmailThreadId: gmailSend.threadId,
  });
  await updateOpportunityTouchTimestamps(opportunity.id, {
    lastOutboundAt: sentAt,
    nextFollowUpAt: addDaysIso(sentAt, NUDGE_DUE_AFTER_DAYS),
    gmailThreadId: gmailSend.threadId,
  });

  return { result: "sent", sentAt, subject };
}
