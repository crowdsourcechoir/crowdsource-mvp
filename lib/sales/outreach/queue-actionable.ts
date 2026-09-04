import { reopenQueueItem } from "@/lib/sales/db/queue";
import { updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import type { ApprovalQueueItem } from "@/lib/sales/types";

const LOCKED_STATUSES = new Set(["rejected", "deferred", "duplicate"]);

function decidedError(): Error & { status: number } {
  const err = new Error("Queue item already decided.") as Error & { status: number };
  err.status = 409;
  return err;
}

/**
 * Due-today / already-sent orgs still need to pick remaining contacts (community@, tickets@).
 * Reopen approved rows. Rejected / deferred / duplicate stay closed.
 */
export async function ensureQueueItemActionable(item: ApprovalQueueItem): Promise<ApprovalQueueItem> {
  if (item.status === "pending") return item;
  if (LOCKED_STATUSES.has(item.status)) throw decidedError();

  const reopened = await reopenQueueItem(item.id);
  if (item.kind === "initial") {
    await updateOpportunityStatus(item.opportunityId, "ready_for_review");
  }
  return reopened;
}
