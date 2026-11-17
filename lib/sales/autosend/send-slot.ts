import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { getContact } from "@/lib/sales/db/contacts";
import {
  getOpportunity,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { getDraft, listDraftsForOpportunity } from "@/lib/sales/db/outreach";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { addDaysIso, gmailDraftUrl, NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import { createGmailDraft, findPriorGmailCorrespondence } from "@/lib/sales/gmail/send";
import { coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { shouldBlockInitialGmailSend } from "@/lib/sales/outreach/send-guard";
import type { OutreachActivity } from "@/lib/sales/types";
import { loadPriorOutreachIndex, priorOutreachSkipReason } from "./dedup";
import type { AutoSendSlot } from "./types";

export type SlotSendResult =
  | { result: "drafted"; draftedAt: string; subject: string; draftUrl: string }
  | { result: "skipped"; error: string }
  | { result: "retry"; error: string };

const DRAFT_NOTE =
  "Gmail draft created. Review it in Gmail Drafts and send it yourself. This queue does not send it.";

function existingGmailDraft(activities: OutreachActivity[], contactId: string): OutreachActivity | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index];
    if (activity.contactId !== contactId) continue;
    if (activity.metadata?.kind !== "gmail_draft") continue;
    const threadId =
      typeof activity.gmailThreadId === "string" && activity.gmailThreadId.trim()
        ? activity.gmailThreadId
        : typeof activity.metadata?.gmailDraftThreadId === "string"
          ? activity.metadata.gmailDraftThreadId
          : null;
    const messageId = activity.metadata?.gmailDraftMessageId;
    if (!threadId && (typeof messageId !== "string" || !messageId.trim())) continue;
    return activity;
  }
  return null;
}

function draftUrlFromActivity(activity: OutreachActivity): string {
  const stored = activity.metadata?.draftUrl;
  if (typeof stored === "string" && stored.trim()) return stored;
  const threadId =
    typeof activity.gmailThreadId === "string" && activity.gmailThreadId.trim()
      ? activity.gmailThreadId
      : typeof activity.metadata?.gmailDraftThreadId === "string"
        ? activity.metadata.gmailDraftThreadId
        : typeof activity.metadata?.gmailDraftMessageId === "string"
          ? activity.metadata.gmailDraftMessageId
          : null;
  return threadId ? gmailDraftUrl(threadId) : "";
}

/**
 * File one lined-up first touch as a Gmail draft without sending.
 * Checks CRM cross-opportunity history, synced Google Calendar meetings, and live Gmail
 * correspondence before calling `users.drafts.create`. `lastOutboundAt` stays unset until
 * Gmail sync observes the message in Sent after Joel sends it manually.
 */
export async function sendAutoSendSlot(slot: AutoSendSlot): Promise<SlotSendResult> {
  const item = await getQueueItem(slot.queueItemId);
  if (!item || item.status !== "pending" || item.kind !== "initial") {
    return { result: "skipped", error: "Queue row is no longer waiting for a draft." };
  }
  const draft = item.outreachDraftId ? await getDraft(item.outreachDraftId) : null;
  if (!draft) return { result: "skipped", error: "Draft is missing." };
  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) return { result: "skipped", error: "Opportunity is missing." };

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
  const alreadyFiled = existingGmailDraft(activities, contact.id);
  if (alreadyFiled) {
    await decideQueueItem(item.id, {
      status: "deferred",
      decidedBy: "autosend",
      decisionNotes: DRAFT_NOTE,
    });
    return {
      result: "drafted",
      draftedAt: alreadyFiled.occurredAt,
      subject,
      draftUrl: draftUrlFromActivity(alreadyFiled),
    };
  }

  if (
    opportunity.lastOutboundAt ||
    opportunity.lastInboundAt ||
    opportunity.gmailThreadId ||
    opportunity.relationshipStage
  ) {
    return { result: "skipped", error: "This organization was already contacted." };
  }

  const priorIndex = await loadPriorOutreachIndex({
    organizationIds: [opportunity.organizationId],
    contactIds: [contact.id],
    emails: [contact.email],
  });
  const priorSkip = priorOutreachSkipReason(priorIndex, {
    opportunityId: opportunity.id,
    organizationId: opportunity.organizationId,
    contactId: contact.id,
    email: contact.email,
  });
  if (priorSkip) {
    const reason =
      priorSkip === "meeting on calendar"
        ? "Skipped — calendar meeting already exists with this contact or organization."
        : "Skipped — prior outreach already exists for this contact or organization.";
    await decideQueueItem(item.id, {
      status: "deferred",
      decidedBy: "autosend",
      decisionNotes: reason,
    });
    return { result: "skipped", error: reason };
  }

  const siblingDrafts = await listDraftsForOpportunity(opportunity.id);
  const blocked = shouldBlockInitialGmailSend({
    itemKind: item.kind,
    draft,
    activities,
    siblingDrafts,
  });
  if (blocked.blocked) return { result: "skipped", error: blocked.reason ?? "Draft blocked." };

  const priorGmail = await findPriorGmailCorrespondence(contact.email).catch(() => null);
  if (priorGmail) {
    const occurredAt = priorGmail.occurredAt ?? new Date().toISOString();
    await updateOpportunityTouchTimestamps(opportunity.id, {
      gmailThreadId: opportunity.gmailThreadId ?? priorGmail.threadId,
      ...(priorGmail.sentByUs && !opportunity.lastOutboundAt
        ? {
            lastOutboundAt: occurredAt,
            nextFollowUpAt: opportunity.nextFollowUpAt ?? addDaysIso(occurredAt, NUDGE_DUE_AFTER_DAYS),
          }
        : {}),
    });
    if (priorGmail.sentByUs && !opportunity.relationshipStage) {
      await updateOpportunityRelationshipStage(opportunity.id, "awareness");
      await updateOpportunityStatus(opportunity.id, "approved");
    }
    const reason = "Skipped — prior Gmail correspondence already exists with this contact.";
    await decideQueueItem(item.id, {
      status: "deferred",
      decidedBy: "autosend",
      decisionNotes: reason,
    });
    return { result: "skipped", error: reason };
  }

  let gmailDraft: { draftId: string; messageId: string; threadId: string; draftUrl: string };
  try {
    gmailDraft = await createGmailDraft({ to: contact.email, subject, body });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail draft failed.";
    const missingScope = /compose|permission to create drafts/i.test(message);
    return { result: missingScope ? "skipped" : "retry", error: message };
  }

  const draftedAt = new Date().toISOString();
  await createOutreachActivity({
    opportunityId: opportunity.id,
    contactId: contact.id,
    activityType: "note",
    occurredAt: draftedAt,
    gmailThreadId: gmailDraft.threadId,
    metadata: {
      kind: "gmail_draft",
      autosend: true,
      queueItemId: item.id,
      draftId: draft.id,
      gmailDraftId: gmailDraft.draftId,
      gmailDraftMessageId: gmailDraft.messageId,
      gmailDraftThreadId: gmailDraft.threadId,
      draftUrl: gmailDraft.draftUrl,
    },
  });
  await updateOpportunityTouchTimestamps(opportunity.id, {
    gmailThreadId: gmailDraft.threadId,
  });
  await decideQueueItem(item.id, {
    status: "deferred",
    decidedBy: "autosend",
    decisionNotes: DRAFT_NOTE,
  });

  return { result: "drafted", draftedAt, subject, draftUrl: gmailDraft.draftUrl };
}
