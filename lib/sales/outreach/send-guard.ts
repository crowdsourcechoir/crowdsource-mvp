import type { OutreachActivity, OutreachDraft, OutreachDraftKind, OutreachDraftStatus } from "@/lib/sales/types";

export const OPEN_DRAFT_STATUSES = new Set<OutreachDraftStatus>(["draft", "qa_flagged", "qa_passed"]);
export const SENT_DRAFT_STATUSES = new Set<OutreachDraftStatus>(["approved", "approved_with_edits"]);
export const HANDLED_DRAFT_STATUSES = new Set<OutreachDraftStatus>([
  "approved",
  "approved_with_edits",
  "rejected",
]);

export function isOpenDraftStatus(status: string): boolean {
  return OPEN_DRAFT_STATUSES.has(status as OutreachDraftStatus);
}

export function isSentDraftStatus(status: string): boolean {
  return SENT_DRAFT_STATUSES.has(status as OutreachDraftStatus);
}

export type SendGuardDraft = {
  id: string;
  contactId: string | null;
  kind: OutreachDraftKind | string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type SendGuardActivity = {
  activityType: string;
  contactId: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown> | null;
};

function isInitialKind(kind: string | null | undefined): boolean {
  return (kind ?? "initial") === "initial";
}

function activityKind(activity: SendGuardActivity): string {
  const kind = activity.metadata?.kind;
  return typeof kind === "string" ? kind : "initial";
}

function isoTime(value: string | undefined): number {
  const t = Date.parse(value ?? "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * Block a second *initial* Gmail send to the same person.
 *
 * Duplicate open drafts (the 2026-08-15 Seahawks incident) must not send again.
 * An explicit remint is allowed only when this draft was created *after* the
 * last initial send / approved sibling for that contact.
 */
export function shouldBlockInitialGmailSend(input: {
  itemKind: string;
  draft: SendGuardDraft;
  activities: SendGuardActivity[];
  siblingDrafts: SendGuardDraft[];
}): { blocked: boolean; reason?: string } {
  if (input.itemKind !== "initial" || !isInitialKind(input.draft.kind)) {
    return { blocked: false };
  }
  if (isSentDraftStatus(input.draft.status) || input.draft.status === "rejected") {
    return {
      blocked: true,
      reason: "Gmail send blocked — this draft was already approved. Pick another contact or remint a fresh draft.",
    };
  }

  const contactId = input.draft.contactId;
  if (!contactId) return { blocked: false };

  const draftCreatedAt = isoTime(input.draft.createdAt);

  const priorSent = input.activities.filter(
    (a) => a.activityType === "sent" && a.contactId === contactId && isInitialKind(activityKind(a))
  );
  const lastSentAt = Math.max(0, ...priorSent.map((a) => isoTime(a.occurredAt)));
  if (priorSent.length > 0 && draftCreatedAt <= lastSentAt) {
    return {
      blocked: true,
      reason:
        "Gmail send blocked — this contact already received initial outreach. Pick another contact; remint only if you intentionally want a new draft.",
    };
  }

  const approvedSiblings = input.siblingDrafts.filter(
    (d) =>
      d.id !== input.draft.id &&
      d.contactId === contactId &&
      isInitialKind(d.kind) &&
      isSentDraftStatus(d.status)
  );
  if (approvedSiblings.length > 0) {
    const newestSiblingAt = Math.max(
      0,
      ...approvedSiblings.map((d) => Math.max(isoTime(d.updatedAt), isoTime(d.createdAt)))
    );
    if (draftCreatedAt <= newestSiblingAt) {
      return {
        blocked: true,
        reason:
          "Gmail send blocked — this contact already has approved initial outreach. Duplicate drafts will not send.",
      };
    }
  }

  return { blocked: false };
}

/**
 * After sending one contact, keep the org in queue only for *other* people who
 * still have an unsent open draft. Never auto-advance to the person just sent,
 * even if a duplicate open draft remains (that was the multi-send loop).
 */
export function pickNextRemainingInitialDraft(input: {
  drafts: SendGuardDraft[];
  readyContactIds: Set<string>;
  justSentDraftId?: string | null;
  justSentContactId?: string | null;
}): { id: string; contactId: string } | null {
  const handledContactIds = new Set<string>();
  if (input.justSentContactId) handledContactIds.add(input.justSentContactId);
  for (const d of input.drafts) {
    if (!isInitialKind(d.kind) || !d.contactId) continue;
    if (HANDLED_DRAFT_STATUSES.has(d.status as OutreachDraftStatus)) {
      handledContactIds.add(d.contactId);
    }
  }

  const next = input.drafts.find((d) => {
    if (!isInitialKind(d.kind) || !d.contactId) return false;
    if (d.id === input.justSentDraftId) return false;
    if (!input.readyContactIds.has(d.contactId)) return false;
    if (handledContactIds.has(d.contactId)) return false;
    return isOpenDraftStatus(d.status);
  });

  if (!next?.contactId) return null;
  return { id: next.id, contactId: next.contactId };
}

export function gmailSendsAllowed(input: {
  envFlag?: string | null;
  connectionSendsEnabled?: boolean | null;
}): boolean {
  const env = input.envFlag?.trim();
  if (env === "false") return false;
  if (input.connectionSendsEnabled === true) return true;
  return env === "true";
}

export function asSendGuardDraft(draft: Pick<OutreachDraft, "id" | "contactId" | "kind" | "status" | "createdAt" | "updatedAt">): SendGuardDraft {
  return draft;
}

export function asSendGuardActivity(
  activity: Pick<OutreachActivity, "activityType" | "contactId" | "occurredAt" | "metadata">
): SendGuardActivity {
  return activity;
}
