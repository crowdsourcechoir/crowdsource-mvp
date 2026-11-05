import { getContact, updateContact } from "@/lib/sales/db/contacts";
import { getOrganization } from "@/lib/sales/db/organizations";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { createOutreachDraft } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem, getQueueItem, setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { getOpportunity, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  genericMailboxLabel,
  isPlausibleEmail,
  isSendableContact,
  normalizeEmail,
} from "@/lib/sales/dedupe";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import { draftCopyForContact, ensureContactDrafts } from "@/lib/sales/seed/enqueue-manual";
import { parseManualContactInput } from "@/lib/sales/seed/add-manual";
import type { Contact, QueueItemDetail } from "@/lib/sales/types";

async function opportunityTypeKeyFor(opportunityTypeId: string | null | undefined): Promise<string | null> {
  if (!opportunityTypeId) return null;
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunity_types")
    .select("key")
    .eq("id", opportunityTypeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.key === "string" ? data.key : null;
}

export type UpdateQueueContactResult = {
  contact: Contact;
  detail: QueueItemDetail | null;
  message: string;
  selected: boolean;
};

/**
 * Edit a contact from the queue card (name / email / role).
 * Re-verifies when the email changes, mints a draft when the contact becomes sendable,
 * and returns refreshed queue detail when `queueItemId` is provided.
 */
export async function updateQueueContact(input: {
  contactId: string;
  queueItemId?: string | null;
  fullName: string;
  email?: string | null;
  roleTitle?: string | null;
}): Promise<UpdateQueueContactResult> {
  const existing = await getContact(input.contactId);
  if (!existing) throw new Error("Contact not found.");

  // undefined email = keep current; null/"" = clear; string = replace.
  const emailInput = input.email === undefined ? existing.email : input.email;
  const parsed = parseManualContactInput(input.fullName, emailInput);
  if (!parsed.displayName && !parsed.email) {
    throw new Error("Use a first and last name, or a general inbox like info@ or events@.");
  }

  const fullName = parsed.displayName || (parsed.email ? genericMailboxLabel(parsed.email) : existing.fullName) || "";
  const nextEmail = parsed.email && isPlausibleEmail(parsed.email) ? (normalizeEmail(parsed.email) as string) : null;
  const prevEmail = normalizeEmail(existing.email);
  const emailChanged = nextEmail !== prevEmail;
  const roleTitle =
    input.roleTitle !== undefined
      ? input.roleTitle?.trim() || (parsed.isGenericMailbox ? "General inbox" : null)
      : existing.roleTitle;

  let emailVerificationStatus = existing.emailVerificationStatus;
  let importMetadata = existing.importMetadata ? { ...existing.importMetadata } : null;
  let messageExtra = "";

  if (!nextEmail) {
    emailVerificationStatus = "unverified";
  } else if (emailChanged) {
    const verified = await verifyEmailAddress(nextEmail);
    emailVerificationStatus =
      verified.status === "unverified" ? "valid_format" : verified.status;
    if (importMetadata && "hunterBounceOverride" in importMetadata) {
      const rest = { ...importMetadata };
      delete rest.hunterBounceOverride;
      delete rest.hunterBounceOverrideAt;
      delete rest.hunterBounceOverrideEmail;
      importMetadata = Object.keys(rest).length ? rest : null;
    }
    if (verified.status === "invalid") {
      messageExtra = ` Hunter says ${nextEmail} will bounce — Override bounce or fix the email before sending.`;
    } else if (verified.status === "risky") {
      messageExtra = ` Hunter flagged ${nextEmail} as ${verified.hunterStatus ?? "risky"} (catch-all) — send if you trust it.`;
    } else if (verified.status !== "verified_deliverable") {
      messageExtra = ` Hunter status: ${verified.hunterStatus ?? verified.status}.`;
    }
  }
  // Same normalized address with dirty stored form (trailing ".") — keep verification, persist clean.

  let contact = await updateContact(existing.id, {
    fullName,
    email: nextEmail,
    roleTitle,
    emailVerificationStatus,
    importMetadata,
  });

  let detail: QueueItemDetail | null = null;
  let selected = false;

  if (!input.queueItemId) {
    return {
      contact,
      detail: null,
      selected: false,
      message: `Updated ${contact.fullName ?? "contact"}.${messageExtra}`,
    };
  }

  let item = await getQueueItem(input.queueItemId);
  if (!item) {
    return {
      contact,
      detail: null,
      selected: false,
      message: `Updated ${contact.fullName ?? "contact"}.${messageExtra}`,
    };
  }

  const wasDecided = item.status !== "pending";
  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  if (contact.organizationId !== opportunity.organizationId) {
    throw new Error("Contact is not on this organization.");
  }
  const organization = await getOrganization(opportunity.organizationId);
  if (!organization) throw new Error("Organization not found.");

  if (isSendableContact(contact)) {
    const opportunityTypeKey = await opportunityTypeKeyFor(opportunity.opportunityTypeId);
    const created = await ensureContactDrafts({
      organization,
      opportunityId: opportunity.id,
      pipelineRunId: null,
      opportunityTypeKey,
      eventName: opportunity.eventOrInitiativeName,
    });
    let draft = created.drafts.find((d) => d.contactId === contact.id) ?? null;
    if (!draft || draft.contactId !== contact.id || (draft.status !== "draft" && draft.status !== "qa_flagged")) {
      const copy = draftCopyForContact(organization.name, contact, {
        opportunityTypeKey,
        eventName: opportunity.eventOrInitiativeName,
      });
      draft = await createOutreachDraft({
        opportunityId: opportunity.id,
        contactId: contact.id,
        pipelineRunId: null,
        kind: "initial",
        status: "draft",
        confidenceScore: 0.55,
        aiSubject: copy.subject,
        aiBody: copy.body,
      });
    }

    if (wasDecided) {
      item = await createOrUpdateQueueItem({
        opportunityId: opportunity.id,
        outreachDraftId: draft.id,
        prospectScoreId: item.prospectScoreId,
        reopenDecided: true,
      });
      if (item.kind === "initial") {
        await updateOpportunityStatus(opportunity.id, "ready_for_review");
      }
    } else {
      item = await setQueueItemOutreachDraft(item.id, draft.id);
    }
    selected = true;
  }

  detail = await assembleQueueItemDetailFromQueueItem(item);
  // Prefer the just-updated contact object in case assemble raced a stale read.
  if (detail) {
    detail = {
      ...detail,
      contacts: (detail.contacts ?? []).map((c) => (c.id === contact.id ? contact : c)),
      contact: detail.contact?.id === contact.id ? contact : detail.contact,
    };
  }

  const needsEmailNote = !nextEmail
    ? " Add an email to draft outreach."
    : emailVerificationStatus === "invalid"
      ? ""
      : selected
        ? " Draft ready."
        : "";

  return {
    contact,
    detail,
    selected,
    message: `Updated ${contact.fullName ?? "contact"}.${messageExtra}${needsEmailNote}${
      wasDecided && selected ? " Reopened in To send." : ""
    }`,
  };
}
