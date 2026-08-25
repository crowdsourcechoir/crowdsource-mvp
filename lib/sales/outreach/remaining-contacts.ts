import { hasVerifiedEmail, looksLikePersonName } from "@/lib/sales/dedupe";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import type { Contact, OutreachDraft } from "@/lib/sales/types";

const OPEN_DRAFT_STATUSES = new Set(["draft", "qa_flagged", "qa_passed"]);
const HANDLED_DRAFT_STATUSES = new Set(["approved", "approved_with_edits", "rejected"]);

/** Named, email-ready, not hidden, not hard-blocked. */
export function isQueueReadyContact(contact: Contact): boolean {
  if (contact.duplicateOfContactId) return false;
  if (!looksLikePersonName(contact.fullName)) return false;
  if (!contact.email || !hasVerifiedEmail(contact)) return false;
  if (isOutboundEmailBlocked(contact.email)) return false;
  return true;
}

export function isOpenInitialDraft(draft: OutreachDraft): boolean {
  return draft.kind === "initial" && Boolean(draft.contactId) && OPEN_DRAFT_STATUSES.has(draft.status);
}

/**
 * Next unsent initial draft for a still-visible, email-ready contact.
 * Hidden contacts (duplicateOfContactId) must not keep an org stuck in the queue.
 */
export function findNextOpenDraft(input: {
  contacts: Contact[];
  drafts: OutreachDraft[];
  excludeContactId?: string | null;
  excludeDraftId?: string | null;
}): OutreachDraft | null {
  const readyIds = new Set(input.contacts.filter(isQueueReadyContact).map((c) => c.id));
  const openContactIds = new Set(
    input.drafts.filter(isOpenInitialDraft).map((d) => d.contactId as string)
  );
  const handledContactIds = new Set(
    input.drafts
      .filter(
        (d) =>
          d.kind === "initial" &&
          d.contactId &&
          !openContactIds.has(d.contactId) &&
          HANDLED_DRAFT_STATUSES.has(d.status)
      )
      .map((d) => d.contactId as string)
  );

  return (
    input.drafts.find(
      (d) =>
        isOpenInitialDraft(d) &&
        d.contactId &&
        readyIds.has(d.contactId) &&
        d.id !== input.excludeDraftId &&
        d.contactId !== input.excludeContactId &&
        !handledContactIds.has(d.contactId)
    ) ?? null
  );
}

export function remainingOpenDraftCount(input: {
  contacts: Contact[];
  drafts: OutreachDraft[];
  excludeContactId?: string | null;
  excludeDraftId?: string | null;
}): number {
  const next = findNextOpenDraft(input);
  if (!next) return 0;
  const readyIds = new Set(input.contacts.filter(isQueueReadyContact).map((c) => c.id));
  return input.drafts.filter(
    (d) =>
      isOpenInitialDraft(d) &&
      d.contactId &&
      readyIds.has(d.contactId) &&
      d.id !== input.excludeDraftId &&
      d.contactId !== input.excludeContactId
  ).length;
}
