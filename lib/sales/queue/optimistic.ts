import type { OutreachDraft, QueueItemDetail } from "@/lib/sales/types";
import { placeholderSentDraft } from "@/lib/sales/outreach/external-sent";

const SENT_STATUSES = new Set(["approved", "approved_with_edits"]);
const OPEN_STATUSES = new Set(["draft", "qa_flagged", "qa_passed"]);

/** Slim select-contact / mark-sent JSON — never assume `detail` is present. */
export type QueueMutationPayload = {
  remaining?: boolean;
  nextContactId?: string | null;
  nextDraftId?: string | null;
  contactId?: string | null;
  draftId?: string | null;
  draft?: OutreachDraft | null;
  detail?: QueueItemDetail | null;
};

/**
 * Old queue JS did `data.detail.draft` after slim APIs stopped returning `detail`.
 * Always use this (or `?.`) — never `data.detail.draft`.
 */
export function draftFromMutationPayload(data: QueueMutationPayload | null | undefined): OutreachDraft | null {
  if (!data || typeof data !== "object") return null;
  return data.detail?.draft ?? data.draft ?? null;
}

export function applySentDraft(item: QueueItemDetail, contactId: string): QueueItemDetail {
  const existing = item.contactDrafts ?? [];
  let found = false;
  const contactDrafts = existing.map((d) => {
    if (d.contactId !== contactId) return d;
    found = true;
    return OPEN_STATUSES.has(d.status) ? { ...d, status: "approved" as const } : d;
  });
  if (!found) {
    contactDrafts.push(
      placeholderSentDraft({
        opportunityId: item.opportunity?.id ?? item.queueItem?.opportunityId ?? "",
        contactId,
      })
    );
  }
  return {
    ...item,
    contactDrafts,
    opportunity: item.opportunity
      ? {
          ...item.opportunity,
          relationshipStage: item.opportunity.relationshipStage ?? "awareness",
        }
      : item.opportunity,
    contactOutreach: {
      ...(item.contactOutreach ?? {}),
      [contactId]: {
        sentAt: new Date().toISOString(),
        repliedAt: item.contactOutreach?.[contactId]?.repliedAt ?? null,
        replyKind: item.contactOutreach?.[contactId]?.replyKind ?? null,
        bouncedAt: item.contactOutreach?.[contactId]?.bouncedAt ?? null,
        snippet: item.contactOutreach?.[contactId]?.snippet ?? null,
        gmailThreadId: item.contactOutreach?.[contactId]?.gmailThreadId ?? item.opportunity?.gmailThreadId ?? null,
        gmailMessageId: item.contactOutreach?.[contactId]?.gmailMessageId ?? null,
      },
    },
  };
}

export function applySelectedContact(
  item: QueueItemDetail,
  contactId: string,
  draftOverride?: OutreachDraft | null
): QueueItemDetail | null {
  const contact = (item.contacts ?? []).find((c) => c.id === contactId) ?? null;
  const existing = (item.contactDrafts ?? []).find((d) => d.contactId === contactId) ?? null;
  const draft = draftOverride ?? existing;
  if (!contact || !draft) return null;
  const others = (item.contactDrafts ?? []).filter((d) => d.contactId !== contactId);
  return {
    ...item,
    contact,
    draft,
    contactDrafts: [...others, draft],
    queueItem: item.queueItem ? { ...item.queueItem, outreachDraftId: draft.id } : item.queueItem,
  };
}

/** Apply slim `{ draft, contactId }` or a full `{ detail }` payload without throwing. */
export function applySelectContactResponse(
  item: QueueItemDetail,
  data: QueueMutationPayload | null | undefined,
  requestedContactId: string
): QueueItemDetail {
  if (data?.detail?.queueItem) return data.detail;
  const contactId =
    (typeof data?.nextContactId === "string" && data.nextContactId) ||
    requestedContactId ||
    (typeof data?.contactId === "string" && data.contactId) ||
    "";
  if (!contactId) return item;
  return applySelectedContact(item, contactId, draftFromMutationPayload(data)) ?? item;
}

export function isSentDraftStatus(status: string): boolean {
  return SENT_STATUSES.has(status);
}

export function isOpenDraftStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}
