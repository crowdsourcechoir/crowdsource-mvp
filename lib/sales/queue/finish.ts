import { isOpenDraftStatus, isSentDraftStatus } from "../outreach/send-guard";
import type { ApprovalQueueItemStatus } from "../types";

export type QueueFinishPlan = {
  rejectIds: string[];
  queueStatus: Extract<ApprovalQueueItemStatus, "approved" | "deferred">;
  alreadySent: boolean;
};

/** Close leftover first-touch drafts and leave the send queue without emailing anyone else. */
export function planQueueFinish(
  drafts: { id: string; kind?: string | null; status: string }[],
  lastOutboundAt: string | null
): QueueFinishPlan {
  const rejectIds = drafts
    .filter((d) => (d.kind ?? "initial") === "initial" && isOpenDraftStatus(d.status))
    .map((d) => d.id);
  const alreadySent =
    Boolean(lastOutboundAt) || drafts.some((d) => (d.kind ?? "initial") === "initial" && isSentDraftStatus(d.status));
  return {
    rejectIds,
    queueStatus: alreadySent ? "approved" : "deferred",
    alreadySent,
  };
}
