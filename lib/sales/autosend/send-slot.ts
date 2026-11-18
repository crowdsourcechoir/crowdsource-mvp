import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { getContact } from "@/lib/sales/db/contacts";
import { getOpportunity, updateOpportunityTouchTimestamps } from "@/lib/sales/db/opportunities";
import { getDraft, listDraftsForOpportunity } from "@/lib/sales/db/outreach";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { gmailDraftUrl } from "@/lib/sales/gmail/constants";
import { createGmailDraft } from "@/lib/sales/gmail/send";
import { normalizeEmail } from "@/lib/sales/dedupe";
import { coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { shouldBlockInitialGmailSend } from "@/lib/sales/outreach/send-guard";
import type { OutreachActivity } from "@/lib/sales/types";
import { loadPriorOutreachSuppression } from "./candidates";
import type { AutoSendSlot } from "./types";

export type SlotSendResult =
  | { result: "drafted"; draftedAt: string; subject: string; body: string; draftUrl: string; gmailDraftId: string | null }
  | { result: "skipped"; error: string }
  | { result: "retry"; error: string };

const DRAFT_NOTE =
  "Gmail draft created. Review it in Gmail Drafts and send it yourself. This queue does not send it.";

function existingGmailDraft(activities: OutreachActivity[], contactId: string): OutreachActivity | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index];
    if (activity.contactId !== contactId) continue;
    if (activity.metadata?.kind !== "gmail_draft") continue;
    if (activity.metadata?.retracted === true) continue;
    const messageId = activity.metadata?.gmailDraftMessageId;
    if (typeof messageId !== "string" || !messageId.trim()) continue;
    return activity;
  }
  return null;
}

function draftUrlFromActivity(activity: OutreachActivity): string {
  const stored = activity.metadata?.draftUrl;
  if (typeof stored === "string" && stored.trim()) return stored;
  const messageId = activity.metadata?.gmailDraftMessageId;
  return typeof messageId === "string" ? gmailDraftUrl(messageId) : "";
}

/**
 * File one lined-up first touch as a Gmail draft. Does not send and does not
 * set last outbound, so the nudge clock stays off until Gmail sync sees the
 * message in Sent. The draft thread id is stored so that later send matches,
 * and the queue row is deferred so the next tick does not file a second draft.
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
  if (
    contact.emailVerificationStatus !== "verified_deliverable" &&
    contact.emailVerificationStatus !== "valid_format"
  ) {
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
    const storedDraftId =
      typeof alreadyFiled.metadata?.gmailDraftId === "string" ? alreadyFiled.metadata.gmailDraftId : null;
    return {
      result: "drafted",
      draftedAt: alreadyFiled.occurredAt,
      subject,
      body,
      draftUrl: draftUrlFromActivity(alreadyFiled),
      gmailDraftId: storedDraftId,
    };
  }

  if (opportunity.lastOutboundAt || opportunity.lastInboundAt || opportunity.gmailThreadId) {
    return { result: "skipped", error: "This organization was already contacted." };
  }

  const suppression = await loadPriorOutreachSuppression([opportunity.organizationId], [contact.id]);
  const normalizedEmail = normalizeEmail(contact.email);
  if (
    suppression.contactedOrgIds.has(opportunity.organizationId) ||
    suppression.contactedContactIds.has(contact.id) ||
    (normalizedEmail && suppression.contactedEmails.has(normalizedEmail))
  ) {
    return { result: "skipped", error: "Prior outreach or calendar meeting found for this contact/organization." };
  }

  const siblingDrafts = await listDraftsForOpportunity(opportunity.id);
  const blocked = shouldBlockInitialGmailSend({
    itemKind: item.kind,
    draft,
    activities,
    siblingDrafts,
  });
  if (blocked.blocked) return { result: "skipped", error: blocked.reason ?? "Draft blocked." };

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
    metadata: {
      kind: "gmail_draft",
      autosend: true,
      queueItemId: item.id,
      gmailDraftId: gmailDraft.draftId,
      gmailDraftMessageId: gmailDraft.messageId,
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

  return {
    result: "drafted",
    draftedAt,
    subject,
    body,
    draftUrl: gmailDraft.draftUrl,
    gmailDraftId: gmailDraft.draftId,
  };
}
