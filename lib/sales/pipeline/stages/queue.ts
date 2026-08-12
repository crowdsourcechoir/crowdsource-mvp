import { getMinLeadScore } from "../../digest/config";
import { createOrUpdateQueueItem, retractPendingQueueItemForOpportunity } from "../../db/queue";
import { updateOpportunityStatus } from "../../db/opportunities";
import type { Organization, Opportunity } from "../../types";

export type QueueStageOutput = {
  queueItemId: string | null;
  duplicateWarning: boolean;
  skippedReason: string | null;
  retractedStalePendingItem?: boolean;
};

export type QueueStageGate = {
  contactIsQueueReady: boolean;
  /** Latest totalScore for this opportunity — required for the solid-lead (≥70) bar. */
  totalScore: number | null;
};

/**
 * Deterministic — assembles what already exists into one reviewable row. No AI call.
 *
 * Gates (both required for queue entry):
 * 1. Solid lead score ≥ getMinLeadScore() (default 70) — below that → `needs_more_research`,
 *    no queue row (Joel only wants solid leads in the human queue).
 * 2. Verified contact email — otherwise → `awaiting_contact`.
 *
 * Also retracts a stale pending queue row when gated off, so pre-gate junk doesn't linger.
 */
export async function runQueueStage(
  org: Organization,
  opportunity: Opportunity,
  prospectScoreId: string | null,
  outreachDraftId: string | null,
  gate: QueueStageGate
): Promise<{ output: QueueStageOutput }> {
  const minScore = getMinLeadScore();
  const score = gate.totalScore;

  if (score == null || score < minScore) {
    await updateOpportunityStatus(opportunity.id, "needs_more_research");
    const retracted = await retractPendingQueueItemForOpportunity(opportunity.id);
    return {
      output: {
        queueItemId: null,
        duplicateWarning: false,
        skippedReason:
          score == null
            ? `No score — not surfaced (solid-lead bar is ${minScore}).`
            : `Score ${score.toFixed(0)} is below the solid-lead bar (${minScore}) — not surfaced in the approval queue.`,
        retractedStalePendingItem: retracted,
      },
    };
  }

  if (!gate.contactIsQueueReady) {
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
