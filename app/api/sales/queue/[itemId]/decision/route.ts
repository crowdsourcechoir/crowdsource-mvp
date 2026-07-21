import { NextResponse } from "next/server";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { updateDraftDecision } from "@/lib/sales/db/outreach";
import { updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import type { ApprovalQueueItemStatus, OpportunityStatus } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

const ACTION_TO_QUEUE_STATUS: Record<string, ApprovalQueueItemStatus> = {
  approve: "approved",
  approve_with_edits: "approved_with_edits",
  reject: "rejected",
  defer: "deferred",
  request_more_research: "needs_more_research",
  mark_duplicate: "duplicate",
};

const QUEUE_STATUS_TO_OPPORTUNITY_STATUS: Record<ApprovalQueueItemStatus, OpportunityStatus> = {
  pending: "ready_for_review",
  approved: "approved",
  approved_with_edits: "approved",
  rejected: "rejected",
  deferred: "deferred",
  needs_more_research: "needs_more_research",
  duplicate: "duplicate",
};

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const action = body?.action as string;
    const queueStatus = ACTION_TO_QUEUE_STATUS[action];
    if (!queueStatus) {
      return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
    }

    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await decideQueueItem(itemId, {
      status: queueStatus,
      decisionNotes: body?.notes ?? null,
      decidedBy: body?.decidedBy ?? "operator",
      deferredUntil: body?.deferredUntil ?? undefined,
    });

    await updateOpportunityStatus(item.opportunityId, QUEUE_STATUS_TO_OPPORTUNITY_STATUS[queueStatus]);

    if (item.outreachDraftId && (action === "approve" || action === "approve_with_edits")) {
      await updateDraftDecision(item.outreachDraftId, {
        status: action === "approve_with_edits" ? "approved_with_edits" : "approved",
        editedSubject: action === "approve_with_edits" ? body?.editedSubject ?? undefined : undefined,
        editedBody: action === "approve_with_edits" ? body?.editedBody ?? undefined : undefined,
      });
    } else if (item.outreachDraftId && action === "reject") {
      await updateDraftDecision(item.outreachDraftId, { status: "rejected" });
    }

    // HubSpot sync on approval is intentionally not implemented in v1 (Phase 2, see docs/sales-platform/roadmap.md)
    // and is fully decoupled from this decision either way — a future sync failure must never affect approval state.

    return NextResponse.json({ queueItem: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
