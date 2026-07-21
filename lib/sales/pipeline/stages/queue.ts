import { createOrUpdateQueueItem, retractPendingQueueItemForOpportunity } from "../../db/queue";
import { updateOpportunityStatus } from "../../db/opportunities";
import type { Organization, Opportunity } from "../../types";

export type QueueStageOutput = {
  queueItemId: string | null;
  duplicateWarning: boolean;
  skippedReason: string | null;
  retractedStalePendingItem?: boolean;
};

/**
 * Deterministic — assembles what already exists into one reviewable row. No AI call.
 *
 * `contactIsQueueReady` gates the actual queue entry (see run-pipeline.ts and
 * docs/sales-platform/ai-workflow.md §4/§10): when false, this deliberately does NOT create an
 * approval_queue_items row — the opportunity is marked `awaiting_contact` instead of
 * `ready_for_review` so it stays visible/re-processable without asking a human to do the contact
 * research the pipeline exists to do. This still runs (and gets its own agent_runs row) even when
 * gated off, rather than being skipped outright in run-pipeline.ts, so a DB error either way is
 * caught and isolated the same way as every other stage.
 *
 * Also retracts a stale, never-decided (`pending`) queue row left over from before this org's
 * contact was re-evaluated as not-ready (e.g. queued before this gate existed at all) — otherwise
 * it would linger in the human's queue forever, showing "no contact identified" with no way to
 * tell it's actually been superseded. A human's actual decision (approved/rejected/deferred/etc.)
 * is never touched by this — see `retractPendingQueueItemForOpportunity`.
 */
export async function runQueueStage(
  org: Organization,
  opportunity: Opportunity,
  prospectScoreId: string | null,
  outreachDraftId: string | null,
  contactIsQueueReady: boolean
): Promise<{ output: QueueStageOutput }> {
  if (!contactIsQueueReady) {
    await updateOpportunityStatus(opportunity.id, "awaiting_contact");
    const retracted = await retractPendingQueueItemForOpportunity(opportunity.id);
    return {
      output: {
        queueItemId: null,
        duplicateWarning: false,
        skippedReason: "No contact with a verified email yet — not surfaced in the approval queue.",
        retractedStalePendingItem: retracted,
      },
    };
  }

  const duplicateWarning = Boolean(org.duplicateOfOrganizationId);

  const item = await createOrUpdateQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId,
    prospectScoreId,
    duplicateWarning,
  });

  await updateOpportunityStatus(opportunity.id, "ready_for_review");

  return { output: { queueItemId: item.id, duplicateWarning, skippedReason: null } };
}
