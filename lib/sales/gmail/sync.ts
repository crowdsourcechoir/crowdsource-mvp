import { createOutreachActivity, findActivityByGmailMessageId, findOpportunityIdByGmailThreadId } from "../db/activities";
import { getContact, listContactsByNormalizedEmail, listContactsForOrganization, updateContactVerification } from "../db/contacts";
import { requireSupabaseAdmin } from "../db/client";
import { getGmailConnection } from "../db/gmail";
import {
  getOpportunity,
  updateOpportunityRelationshipStage,
  updateOpportunityStatus,
  updateOpportunityTouchTimestamps,
} from "../db/opportunities";
import { listDraftsForOpportunity, updateDraftDecision } from "../db/outreach";
import { decideQueueItem, getInitialQueueItemByOpportunity, setQueueItemOutreachDraft } from "../db/queue";
import { isSendableContact } from "../dedupe";
import { classifyInbound, extractEmailAddresses, failedRecipientsFromBounce } from "../outreach/inbound-kind";
import { parseFromHeader, resolveCorrespondent } from "../outreach/reply-correspondent";
import { isOutboundEmailBlocked } from "../outreach/send-blocklist";
import { isOpenDraftStatus, pickNextRemainingInitialDraft } from "../outreach/send-guard";
import { getGmailClient, persistHistoryId } from "./client";
import { GMAIL_OWNER_KEY, NUDGE_DUE_AFTER_DAYS, addDaysIso } from "./constants";

export type GmailSyncResult = {
  skippedReason: string | null;
  historyProcessed: boolean;
  repliesRecorded: number;
  autoRepliesRecorded: number;
  outboundsRecorded: number;
  bouncesRecorded: number;
  errors: string[];
};

type ProcessResult = { reply: boolean; auto: boolean; bounce: boolean; outbound: boolean };

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string | null {
  const hit = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

async function findOpenOpportunityByContactEmail(email: string): Promise<string | null> {
  const db = requireSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  const { data: contacts, error } = await db
    .from("contacts")
    .select("id, organization_id")
    .eq("normalized_email", normalized);
  if (error) throw new Error(error.message);
  if (!contacts?.length) return null;

  for (const contact of contacts) {
    const { data: opps, error: oppErr } = await db
      .from("opportunities")
      .select("id")
      .eq("organization_id", contact.organization_id)
      .not("relationship_stage", "is", null)
      .neq("relationship_stage", "lost")
      .neq("relationship_stage", "purchase")
      .order("last_outbound_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (oppErr) throw new Error(oppErr.message);
    if (opps?.[0]?.id) return opps[0].id as string;
  }
  return null;
}

/**
 * Match a message Joel sent directly from Gmail (or from a draft) to a CRM opportunity
 * by recipient address, including opportunities whose `relationship_stage` is still `null`
 * before first touch.
 */
async function findOpportunityForOutboundRecipients(emails: string[], ourEmail: string): Promise<string | null> {
  const db = requireSupabaseAdmin();
  const self = ourEmail.trim().toLowerCase();
  const recipients = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e && e !== self)));
  for (const email of recipients) {
    const activeId = await findOpenOpportunityByContactEmail(email);
    if (activeId) return activeId;

    const { data: contacts, error } = await db
      .from("contacts")
      .select("id, organization_id")
      .eq("normalized_email", email);
    if (error) throw new Error(error.message);
    for (const contact of contacts ?? []) {
      if (!contact.organization_id) continue;
      const { data: unlaunched, error: oppErr } = await db
        .from("opportunities")
        .select("id")
        .eq("organization_id", contact.organization_id)
        .is("relationship_stage", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (oppErr) throw new Error(oppErr.message);
      if (unlaunched?.[0]?.id) return unlaunched[0].id as string;
    }
  }
  return null;
}

async function resolveContactId(
  opportunityId: string,
  fromEmail: string | null,
  fromName: string | null,
  snippet: string | null
): Promise<string | null> {
  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) return null;
  const orgContacts = await listContactsForOrganization(opportunity.organizationId);
  const match = resolveCorrespondent({
    contactId: null,
    fromEmail,
    fromName,
    snippet,
    contacts: orgContacts,
  });
  if (match) return match.contactId;

  const db = requireSupabaseAdmin();
  const { data: draft } = await db
    .from("outreach_drafts")
    .select("contact_id")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const contactId = (draft?.contact_id as string | null) ?? null;
  if (!contactId) return null;
  const contact = await getContact(contactId);
  if (!contact) return null;
  const draftEmail = (contact.normalizedEmail || contact.email || "").toLowerCase();
  if (fromEmail && draftEmail && draftEmail === fromEmail.toLowerCase()) return contactId;
  return null;
}

async function findOpportunityForFailedRecipient(
  email: string
): Promise<{ opportunityId: string; contactId: string | null } | null> {
  const contacts = await listContactsByNormalizedEmail(email);
  const db = requireSupabaseAdmin();
  for (const contact of contacts) {
    const { data, error } = await db
      .from("outreach_activities")
      .select("opportunity_id, contact_id")
      .eq("contact_id", contact.id)
      .eq("activity_type", "sent")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.opportunity_id) {
      return { opportunityId: data.opportunity_id as string, contactId: contact.id };
    }
  }
  const opportunityId = await findOpenOpportunityByContactEmail(email);
  if (!opportunityId) return null;
  return { opportunityId, contactId: contacts[0]?.id ?? null };
}

async function recordReply(input: {
  opportunityId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
  subject: string | null;
  internalDate: string | null;
  replyKind: "live" | "auto";
}): Promise<boolean> {
  const existing = await findActivityByGmailMessageId(input.gmailMessageId);
  if (existing) return false;

  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) return false;

  const contactId = await resolveContactId(
    input.opportunityId,
    input.fromEmail,
    input.fromName,
    input.snippet
  );
  const occurredAt = input.internalDate
    ? new Date(Number(input.internalDate)).toISOString()
    : new Date().toISOString();

  await createOutreachActivity({
    opportunityId: input.opportunityId,
    contactId,
    activityType: "replied",
    occurredAt,
    gmailMessageId: input.gmailMessageId,
    gmailThreadId: input.gmailThreadId,
    metadata: {
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      snippet: input.snippet,
      subject: input.subject,
      replyKind: input.replyKind,
    },
  });

  if (input.replyKind === "live") {
    const parked =
      opportunity.relationshipStage === "parked" ||
      (opportunity.importMetadata?.parkedFollowUp &&
        typeof opportunity.importMetadata.parkedFollowUp === "object");
    await updateOpportunityTouchTimestamps(input.opportunityId, {
      lastInboundAt: occurredAt,
      // A parked check-in keeps its calendar date. A live reply should not pull it back into today.
      nextFollowUpAt: parked ? opportunity.nextFollowUpAt : occurredAt,
      gmailThreadId: input.gmailThreadId,
    });
    if (!parked && opportunity.relationshipStage === "awareness") {
      await updateOpportunityRelationshipStage(input.opportunityId, "interest");
    }
  }

  return true;
}

async function recordBounce(input: {
  opportunityId: string;
  contactId: string | null;
  gmailMessageId: string;
  gmailThreadId: string;
  failedEmail: string | null;
  snippet: string | null;
  subject: string | null;
  internalDate: string | null;
}): Promise<boolean> {
  const existing = await findActivityByGmailMessageId(input.gmailMessageId);
  if (existing) return false;

  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) return false;

  const occurredAt = input.internalDate
    ? new Date(Number(input.internalDate)).toISOString()
    : new Date().toISOString();

  await createOutreachActivity({
    opportunityId: input.opportunityId,
    contactId: input.contactId,
    activityType: "bounced",
    occurredAt,
    gmailMessageId: input.gmailMessageId,
    gmailThreadId: input.gmailThreadId,
    metadata: {
      failedEmail: input.failedEmail,
      snippet: input.snippet,
      subject: input.subject,
    },
  });

  await updateOpportunityTouchTimestamps(input.opportunityId, {
    nextFollowUpAt: null,
    gmailThreadId: input.gmailThreadId,
  });

  if (input.contactId) {
    await updateContactVerification(input.contactId, "invalid").catch(() => undefined);
  }

  return true;
}


async function recordOutbound(input: {
  opportunityId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  toEmails: string[];
  snippet: string | null;
  subject: string | null;
  internalDate: string | null;
}): Promise<boolean> {
  const existing = await findActivityByGmailMessageId(input.gmailMessageId);
  if (existing) return false;

  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) return false;

  let contactId: string | null = null;
  for (const email of input.toEmails) {
    contactId = await resolveContactId(input.opportunityId, email, null, input.snippet);
    if (contactId) break;
  }

  const occurredAt = input.internalDate
    ? new Date(Number(input.internalDate)).toISOString()
    : new Date().toISOString();

  await createOutreachActivity({
    opportunityId: input.opportunityId,
    contactId,
    activityType: "sent",
    occurredAt,
    gmailMessageId: input.gmailMessageId,
    gmailThreadId: input.gmailThreadId,
    metadata: {
      via: "gmail_sync_outbound",
      toEmails: input.toEmails,
      snippet: input.snippet,
      subject: input.subject,
    },
  });

  await updateOpportunityTouchTimestamps(input.opportunityId, {
    lastOutboundAt: occurredAt,
    nextFollowUpAt: addDaysIso(occurredAt, NUDGE_DUE_AFTER_DAYS),
    gmailThreadId: input.gmailThreadId,
  });

  if (!opportunity.relationshipStage) {
    await updateOpportunityRelationshipStage(input.opportunityId, "awareness");
    if (opportunity.status !== "approved") {
      await updateOpportunityStatus(input.opportunityId, "approved");
    }
  }

  if (contactId) {
    const drafts = await listDraftsForOpportunity(input.opportunityId);
    let justApprovedDraftId: string | null = null;
    for (const draft of drafts) {
      if (draft.contactId === contactId && draft.kind === "initial" && isOpenDraftStatus(draft.status)) {
        await updateDraftDecision(draft.id, { status: "approved" });
        draft.status = "approved";
        justApprovedDraftId = draft.id;
      }
    }
    const queueItem = await getInitialQueueItemByOpportunity(input.opportunityId);
    if (queueItem && (queueItem.status === "pending" || (queueItem.status === "deferred" && queueItem.decidedBy === "autosend"))) {
      const orgContacts = await listContactsForOrganization(opportunity.organizationId);
      const readyIds = new Set(
        orgContacts
          .filter((c) => isSendableContact(c) && c.email && !isOutboundEmailBlocked(c.email))
          .map((c) => c.id)
      );
      const nextDraft = pickNextRemainingInitialDraft({
        drafts,
        readyContactIds: readyIds,
        justSentDraftId: justApprovedDraftId,
        justSentContactId: contactId,
      });
      if (nextDraft && queueItem.status === "pending") {
        await setQueueItemOutreachDraft(queueItem.id, nextDraft.id);
      } else if (!nextDraft) {
        await decideQueueItem(queueItem.id, {
          status: "approved",
          decidedBy: "gmail_sync",
          decisionNotes: "Sent from Gmail (synced).",
        });
        await updateOpportunityStatus(input.opportunityId, "approved");
      }
    }
  }

  return true;
}

async function processInboundMessage(
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  messageId: string,
  ourEmail: string
): Promise<ProcessResult> {
  const empty: ProcessResult = { reply: false, auto: false, bounce: false, outbound: false };
  if (!gmail) return empty;
  const res = await gmail.gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: [
      "From",
      "To",
      "Cc",
      "Delivered-To",
      "Subject",
      "Auto-Submitted",
      "X-Autoreply",
      "Precedence",
      "X-Failed-Recipients",
    ],
  });
  // Unsent drafts in Gmail Drafts have not been sent or received yet.
  if (res.data.labelIds?.includes("DRAFT")) return empty;

  const headers = res.data.payload?.headers;
  const from = headerValue(headers, "From");
  const subject = headerValue(headers, "Subject");
  const fromEmails = extractEmailAddresses(from);
  const toEmails = [
    ...extractEmailAddresses(headerValue(headers, "To")),
    ...extractEmailAddresses(headerValue(headers, "Cc")),
  ];
  const threadId = res.data.threadId;
  const isFromUs = fromEmails.some((email) => email === ourEmail.toLowerCase());
  const isSentOnly =
    Boolean(res.data.labelIds?.includes("SENT")) && !res.data.labelIds?.includes("INBOX");

  // Joel sent or replied from Gmail itself (including sending a filed weekday draft).
  if ((isFromUs || isSentOnly) && threadId && res.data.id) {
    let opportunityId = await findOpportunityIdByGmailThreadId(threadId);
    if (!opportunityId) {
      opportunityId = await findOpportunityForOutboundRecipients(toEmails, ourEmail);
    }
    if (!opportunityId) return empty;
    const recorded = await recordOutbound({
      opportunityId,
      gmailMessageId: res.data.id,
      gmailThreadId: threadId,
      toEmails,
      snippet: res.data.snippet ?? null,
      subject,
      internalDate: res.data.internalDate ?? null,
    });
    return { reply: false, auto: false, bounce: false, outbound: recorded };
  }

  const kind = classifyInbound({
    from,
    subject,
    snippet: res.data.snippet ?? null,
    autoSubmitted: headerValue(headers, "Auto-Submitted"),
    xAutoreply: headerValue(headers, "X-Autoreply"),
    precedence: headerValue(headers, "Precedence"),
    xFailedRecipients: headerValue(headers, "X-Failed-Recipients"),
  });

  if (!threadId || !res.data.id) return empty;

  if (kind === "bounce") {
    const failed = failedRecipientsFromBounce({
      xFailedRecipients: headerValue(headers, "X-Failed-Recipients"),
      snippet: res.data.snippet ?? null,
      to: headerValue(headers, "To"),
    });
    let opportunityId = await findOpportunityIdByGmailThreadId(threadId);
    let contactId: string | null = null;
    if (!opportunityId) {
      for (const email of failed) {
        const match = await findOpportunityForFailedRecipient(email);
        if (match) {
          opportunityId = match.opportunityId;
          contactId = match.contactId;
          break;
        }
      }
    } else if (failed[0]) {
      const contacts = await listContactsByNormalizedEmail(failed[0]);
      const opportunity = await getOpportunity(opportunityId);
      contactId = contacts.find((c) => c.organizationId === opportunity?.organizationId)?.id ?? contacts[0]?.id ?? null;
    }
    if (!opportunityId) return empty;
    const recorded = await recordBounce({
      opportunityId,
      contactId,
      gmailMessageId: res.data.id,
      gmailThreadId: threadId,
      failedEmail: failed[0] ?? null,
      snippet: res.data.snippet ?? null,
      subject,
      internalDate: res.data.internalDate ?? null,
    });
    return { reply: false, auto: false, bounce: recorded, outbound: false };
  }

  let opportunityId = await findOpportunityIdByGmailThreadId(threadId);
  if (!opportunityId) {
    for (const email of fromEmails) {
      opportunityId = await findOpenOpportunityByContactEmail(email);
      if (opportunityId) break;
    }
  }
  if (!opportunityId) return empty;

  const parsedFrom = parseFromHeader(from);
  const recorded = await recordReply({
    opportunityId,
    gmailMessageId: res.data.id,
    gmailThreadId: threadId,
    fromEmail: fromEmails[0] ?? parsedFrom.email,
    fromName: parsedFrom.name,
    snippet: res.data.snippet ?? null,
    subject,
    internalDate: res.data.internalDate ?? null,
    replyKind: kind,
  });
  if (!recorded) return empty;
  return { reply: kind === "live", auto: kind === "auto", bounce: false, outbound: false };
}

/**
 * Poll Gmail history (or a recent inbox fallback) and record live replies, auto-replies, and bounces.
 */
export async function syncGmailReplies(ownerKey: string = GMAIL_OWNER_KEY): Promise<GmailSyncResult> {
  const errors: string[] = [];
  const empty = {
    skippedReason: null as string | null,
    historyProcessed: false,
    repliesRecorded: 0,
    autoRepliesRecorded: 0,
    outboundsRecorded: 0,
    bouncesRecorded: 0,
    errors,
  };
  const bundle = await getGmailClient(ownerKey);
  if (!bundle) {
    return { ...empty, skippedReason: "Gmail not connected or OAuth env not configured." };
  }

  const connection = await getGmailConnection(ownerKey);
  let historyProcessed = false;
  const candidateMessageIds = new Set<string>();

  if (connection?.historyId) {
    try {
      const history = await bundle.gmail.users.history.list({
        userId: "me",
        startHistoryId: connection.historyId,
        historyTypes: ["messageAdded"],
      });
      historyProcessed = true;
      for (const entry of history.data.history ?? []) {
        for (const added of entry.messagesAdded ?? []) {
          if (added.message?.id) candidateMessageIds.add(added.message.id);
        }
      }
      const newHistoryId = history.data.historyId ?? connection.historyId;
      await persistHistoryId(bundle.connectionId, newHistoryId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`history.list failed (${message}); falling back to recent inbox.`);
      try {
        const profile = await bundle.gmail.users.getProfile({ userId: "me" });
        await persistHistoryId(bundle.connectionId, profile.data.historyId ?? null);
      } catch (profileErr) {
        errors.push(profileErr instanceof Error ? profileErr.message : String(profileErr));
      }
    }
  } else {
    try {
      const profile = await bundle.gmail.users.getProfile({ userId: "me" });
      await persistHistoryId(bundle.connectionId, profile.data.historyId ?? null);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (candidateMessageIds.size === 0) {
    try {
      const listed = await bundle.gmail.users.messages.list({
        userId: "me",
        q: "in:inbox newer_than:14d",
        maxResults: 40,
      });
      for (const m of listed.data.messages ?? []) {
        if (m.id) candidateMessageIds.add(m.id);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const bounces = await bundle.gmail.users.messages.list({
      userId: "me",
      q: "from:(mailer-daemon OR postmaster) newer_than:30d",
      maxResults: 20,
    });
    for (const m of bounces.data.messages ?? []) {
      if (m.id) candidateMessageIds.add(m.id);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Recent sends on known CRM threads (Joel replying in Gmail after a prospect wrote back).
  try {
    const sent = await bundle.gmail.users.messages.list({
      userId: "me",
      q: "in:sent newer_than:14d",
      maxResults: 40,
    });
    for (const m of sent.data.messages ?? []) {
      if (m.id) candidateMessageIds.add(m.id);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  let repliesRecorded = 0;
  let autoRepliesRecorded = 0;
  let outboundsRecorded = 0;
  let bouncesRecorded = 0;
  for (const messageId of Array.from(candidateMessageIds)) {
    try {
      const recorded = await processInboundMessage(bundle, messageId, bundle.email);
      if (recorded.reply) repliesRecorded += 1;
      if (recorded.auto) autoRepliesRecorded += 1;
      if (recorded.outbound) outboundsRecorded += 1;
      if (recorded.bounce) bouncesRecorded += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    skippedReason: null,
    historyProcessed,
    repliesRecorded,
    autoRepliesRecorded,
    outboundsRecorded,
    bouncesRecorded,
    errors,
  };
}
