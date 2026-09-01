import { getOpportunity, updateOpportunityStatus } from "../db/opportunities";
import { listDraftsForOpportunity, updateDraftDecision } from "../db/outreach";
import { decideQueueItem, getQueueItem } from "../db/queue";
import { planQueueFinish } from "./finish";

export async function finishQueueItem(itemId: string): Promise<{
  closedDrafts: number;
  alreadySent: boolean;
  queueStatus: string;
}> {
  const item = await getQueueItem(itemId);
  if (!item) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  if (item.status !== "pending") {
    const err = new Error("Queue item already decided.");
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) {
    const err = new Error("Opportunity not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const drafts = await listDraftsForOpportunity(opportunity.id);
  const plan = planQueueFinish(drafts, opportunity.lastOutboundAt);
  for (const id of plan.rejectIds) {
    await updateDraftDecision(id, { status: "rejected" });
  }

  await decideQueueItem(itemId, {
    status: plan.queueStatus,
    decisionNotes: plan.alreadySent
      ? "Done with remaining contacts — left the send queue without sending anyone else."
      : "Left the send queue without sending.",
    decidedBy: "operator",
  });

  if (item.kind === "initial") {
    await updateOpportunityStatus(opportunity.id, plan.queueStatus);
  }

  return {
    closedDrafts: plan.rejectIds.length,
    alreadySent: plan.alreadySent,
    queueStatus: plan.queueStatus,
  };
}
