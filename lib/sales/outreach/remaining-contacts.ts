import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { getOrganization } from "@/lib/sales/db/organizations";
import { listDraftsForOpportunity } from "@/lib/sales/db/outreach";
import { setQueueItemOutreachDraft } from "@/lib/sales/db/queue";
import { isSendableContact } from "@/lib/sales/dedupe";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { pickNextRemainingInitialDraft } from "@/lib/sales/outreach/send-guard";
import { ensureContactDrafts } from "@/lib/sales/seed/enqueue-manual";
import type { ApprovalQueueItem, Contact, Opportunity, Organization, OutreachDraft } from "@/lib/sales/types";

export type RemainingAfterSend = {
  remaining: boolean;
  nextDraft: OutreachDraft | null;
};

/**
 * After one send, keep the org in queue when other sendable contacts remain —
 * including general event inboxes that may not have a draft yet.
 */
export async function resolveRemainingAfterSend(input: {
  item: ApprovalQueueItem;
  opportunity: Opportunity;
  drafts?: OutreachDraft[];
  orgContacts?: Contact[];
  organization?: Organization | null;
  justSentDraftId?: string | null;
  justSentContactId?: string | null;
}): Promise<RemainingAfterSend> {
  if (input.item.kind !== "initial") {
    return { remaining: false, nextDraft: null };
  }

  const organization =
    input.organization ?? (await getOrganization(input.opportunity.organizationId));
  if (!organization) return { remaining: false, nextDraft: null };

  const orgContacts = input.orgContacts ?? (await listContactsForOrganization(organization.id));
  const readyIds = new Set(
    orgContacts
      .filter((c) => isSendableContact(c) && c.email && !isOutboundEmailBlocked(c.email))
      .map((c) => c.id)
  );
  const remainingReady = Array.from(readyIds).filter((id) => id !== input.justSentContactId);
  if (remainingReady.length === 0) {
    return { remaining: false, nextDraft: null };
  }

  let drafts = input.drafts ?? (await listDraftsForOpportunity(input.opportunity.id));
  let next = pickNextRemainingInitialDraft({
    drafts,
    readyContactIds: readyIds,
    justSentDraftId: input.justSentDraftId,
    justSentContactId: input.justSentContactId,
  });

  if (!next) {
    await ensureContactDrafts({
      organization,
      opportunityId: input.opportunity.id,
      pipelineRunId: null,
    });
    drafts = await listDraftsForOpportunity(input.opportunity.id);
    next = pickNextRemainingInitialDraft({
      drafts,
      readyContactIds: readyIds,
      justSentDraftId: input.justSentDraftId,
      justSentContactId: input.justSentContactId,
    });
  }

  if (!next) return { remaining: false, nextDraft: null };
  const nextDraft = drafts.find((d) => d.id === next.id) ?? null;
  if (!nextDraft) return { remaining: false, nextDraft: null };
  await setQueueItemOutreachDraft(input.item.id, nextDraft.id);
  return { remaining: true, nextDraft };
}
