import { createOutreachActivity, findActivityByGmailMessageId, findOpportunityIdByGmailThreadId } from "../db/activities";
import { getContact } from "../db/contacts";
import { requireSupabaseAdmin } from "../db/client";
import { getGmailConnection } from "../db/gmail";
import { getOpportunity, updateOpportunityRelationshipStage, updateOpportunityTouchTimestamps } from "../db/opportunities";
import { getGmailClient, persistHistoryId } from "./client";
import { GMAIL_OWNER_KEY } from "./constants";

export type GmailSyncResult = {
  skippedReason: string | null;
  historyProcessed: boolean;
  repliesRecorded: number;
  errors: string[];
};

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string | null {
  const hit = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

function extractEmailAddresses(fromHeader: string | null): string[] {
  if (!fromHeader) return [];
  const matches = fromHeader.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return (matches ?? []).map((e) => e.toLowerCase());
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

async function recordReply(input: {
  opportunityId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  fromEmail: string | null;
  snippet: string | null;
  internalDate: string | null;
}): Promise<boolean> {
  const existing = await findActivityByGmailMessageId(input.gmailMessageId);
  if (existing) return false;

  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) return false;

  // Prefer the draft contact if present; otherwise leave null.
  let contactId: string | null = null;
  const db = requireSupabaseAdmin();
  const { data: draft } = await db
    .from("outreach_drafts")
    .select("contact_id")
    .eq("opportunity_id", input.opportunityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  contactId = (draft?.contact_id as string | null) ?? null;
  if (contactId) {
    const contact = await getContact(contactId);
    if (!contact) contactId = null;
  }

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
    metadata: { fromEmail: input.fromEmail, snippet: input.snippet },
  });

  await updateOpportunityTouchTimestamps(input.opportunityId, {
    lastInboundAt: occurredAt,
    nextFollowUpAt: null,
    gmailThreadId: input.gmailThreadId,
  });

  if (opportunity.relationshipStage === "awareness") {
    await updateOpportunityRelationshipStage(input.opportunityId, "interest");
  }

  return true;
}

async function processMessageAsPossibleReply(
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  messageId: string,
  ourEmail: string
): Promise<boolean> {
  if (!gmail) return false;
  const res = await gmail.gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Delivered-To", "Subject"],
  });
  const headers = res.data.payload?.headers;
  const from = headerValue(headers, "From");
  const fromEmails = extractEmailAddresses(from);
  if (fromEmails.some((e) => e === ourEmail.toLowerCase())) {
    // Our own outbound — ignore for reply detection.
    return false;
  }
  if (res.data.labelIds?.includes("SENT") && !res.data.labelIds?.includes("INBOX")) {
    return false;
  }

  const threadId = res.data.threadId;
  if (!threadId || !res.data.id) return false;

  let opportunityId = await findOpportunityIdByGmailThreadId(threadId);
  if (!opportunityId) {
    for (const email of fromEmails) {
      opportunityId = await findOpenOpportunityByContactEmail(email);
      if (opportunityId) break;
    }
  }
  if (!opportunityId) return false;

  return recordReply({
    opportunityId,
    gmailMessageId: res.data.id,
    gmailThreadId: threadId,
    fromEmail: fromEmails[0] ?? null,
    snippet: res.data.snippet ?? null,
    internalDate: res.data.internalDate ?? null,
  });
}

/**
 * Poll Gmail history (or a recent inbox fallback) and record replies against tracked opportunities.
 */
export async function syncGmailReplies(ownerKey: string = GMAIL_OWNER_KEY): Promise<GmailSyncResult> {
  const errors: string[] = [];
  const bundle = await getGmailClient(ownerKey);
  if (!bundle) {
    return { skippedReason: "Gmail not connected or OAuth env not configured.", historyProcessed: false, repliesRecorded: 0, errors };
  }

  const connection = await getGmailConnection(ownerKey);
  let repliesRecorded = 0;
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
      // History IDs expire; fall through to inbox scan and refresh historyId.
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

  for (const messageId of Array.from(candidateMessageIds)) {
    try {
      const recorded = await processMessageAsPossibleReply(bundle, messageId, bundle.email);
      if (recorded) repliesRecorded += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { skippedReason: null, historyProcessed, repliesRecorded, errors };
}
