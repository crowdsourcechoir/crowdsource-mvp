import { getGmailClient } from "@/lib/sales/gmail/client";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { createOutreachFeedback, backfillAcceptedEditFeedback } from "@/lib/sales/db/feedback";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { getOrganization } from "@/lib/sales/db/organizations";
import { resolveIndustrySegmentIdForOrganization } from "@/lib/sales/db/lookups";

export type LearnFromSentResult = {
  draftsBackfilled: { created: number; skipped: number };
  gmail: {
    scanned: number;
    matched: number;
    learned: number;
    skipped: number;
    skippedReason?: string | null;
  };
};

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string | null {
  const hit = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractTextBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown;
} | null | undefined): string {
  if (!payload) return "";
  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const part of parts) {
    const text = extractTextBody(part as typeof payload);
    if (text.trim()) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function extractEmailAddresses(header: string | null): string[] {
  if (!header) return [];
  const matches = header.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return (matches ?? []).map((e) => e.toLowerCase());
}

function stripQuoted(body: string): string {
  const withoutSignature = body.split(/^\s*--\s*$/m)[0] ?? body;
  const lines = withoutSignature.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:$/.test(line.trim())) break;
    if (line.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

/**
 * Learn from in-app sent edits, then from Gmail Sent that Joel rewrote outside the app.
 * Only stores feedback when the To: address is a CRM contact (won't ingest unrelated mail).
 */
export async function learnFromSentOutreach(limit = 80): Promise<LearnFromSentResult> {
  const draftsBackfilled = await backfillAcceptedEditFeedback(limit);

  const gmailResult: LearnFromSentResult["gmail"] = {
    scanned: 0,
    matched: 0,
    learned: 0,
    skipped: 0,
    skippedReason: null,
  };

  const bundle = await getGmailClient();
  if (!bundle) {
    gmailResult.skippedReason = "Gmail is not connected.";
    return { draftsBackfilled, gmail: gmailResult };
  }

  const list = await bundle.gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: Math.min(50, limit),
    q: "from:me -in:chats",
  });
  const messages = list.data.messages ?? [];
  const db = requireSupabaseAdmin();

  for (const stub of messages) {
    if (!stub.id) continue;
    gmailResult.scanned += 1;
    const full = await bundle.gmail.users.messages.get({
      userId: "me",
      id: stub.id,
      format: "full",
    });
    const headers = full.data.payload?.headers;
    const toEmails = extractEmailAddresses(headerValue(headers, "To"));
    const subject = (headerValue(headers, "Subject") ?? "").trim();
    const body = stripQuoted(extractTextBody(full.data.payload ?? null));
    if (!toEmails.length || !subject || body.length < 80) {
      gmailResult.skipped += 1;
      continue;
    }

    let matchedContact: { id: string; organization_id: string; outreach_persona: string | null } | null = null;
    for (const email of toEmails) {
      const { data: contacts, error } = await db
        .from("contacts")
        .select("id, organization_id, outreach_persona")
        .eq("normalized_email", email)
        .limit(1);
      if (error) throw new Error(error.message);
      if (contacts?.[0]) {
        matchedContact = contacts[0] as typeof matchedContact;
        break;
      }
    }
    if (!matchedContact) {
      gmailResult.skipped += 1;
      continue;
    }
    gmailResult.matched += 1;

    const { data: opps, error: oppErr } = await db
      .from("opportunities")
      .select("id, opportunity_type_id")
      .eq("organization_id", matchedContact.organization_id)
      .order("last_outbound_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (oppErr) throw new Error(oppErr.message);
    const opportunityId = opps?.[0]?.id as string | undefined;
    if (!opportunityId) {
      gmailResult.skipped += 1;
      continue;
    }

    const { data: existing } = await db
      .from("outreach_feedback")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .eq("contact_id", matchedContact.id)
      .eq("edited_subject", subject)
      .limit(1)
      .maybeSingle();
    if (existing) {
      gmailResult.skipped += 1;
      continue;
    }

    const { data: draft } = await db
      .from("outreach_drafts")
      .select("id, ai_subject, ai_body")
      .eq("opportunity_id", opportunityId)
      .eq("contact_id", matchedContact.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const originalSubject = (draft?.ai_subject as string | undefined) ?? subject;
    const originalBody = (draft?.ai_body as string | undefined) ?? "[draft before Gmail send]";
    if (originalBody.trim() === body.trim() && originalSubject.trim() === subject.trim()) {
      gmailResult.skipped += 1;
      continue;
    }

    const opportunity = await getOpportunity(opportunityId);
    const organization = opportunity ? await getOrganization(opportunity.organizationId) : null;
    const industrySegmentId = organization ? await resolveIndustrySegmentIdForOrganization(organization) : null;

    await createOutreachFeedback({
      opportunityId,
      outreachDraftId: (draft?.id as string | null) ?? null,
      contactId: matchedContact.id,
      opportunityTypeId: (opps?.[0]?.opportunity_type_id as string | null) ?? opportunity?.opportunityTypeId ?? null,
      industrySegmentId,
      outreachPersona: matchedContact.outreach_persona,
      decision: "approved_with_edits",
      originalSubject,
      originalBody,
      editedSubject: subject,
      editedBody: body,
    });
    gmailResult.learned += 1;
  }

  return { draftsBackfilled, gmail: gmailResult };
}
