import { NextResponse } from "next/server";
import { getQueueItem, reopenQueueItem } from "@/lib/sales/db/queue";
import { updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { getDraft, updateDraftEdits } from "@/lib/sales/db/outreach";

export const dynamic = "force-dynamic";

/**
 * Save edited subject/body on the linked outreach draft without approving,
 * sending, or removing the item from the pending queue.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const editedSubject = typeof body?.editedSubject === "string" ? body.editedSubject : null;
    const editedBody = typeof body?.editedBody === "string" ? body.editedBody : null;
    if (editedSubject === null || editedBody === null) {
      return NextResponse.json({ error: "editedSubject and editedBody are required." }, { status: 400 });
    }

    const requestedDraftId = typeof body?.draftId === "string" ? body.draftId.trim() : "";

    let item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.status !== "pending") {
      item = await reopenQueueItem(itemId);
      if (item.kind === "initial") {
        await updateOpportunityStatus(item.opportunityId, "ready_for_review");
      }
    }
    if (!item.outreachDraftId) {
      return NextResponse.json({ error: "No draft on this queue item." }, { status: 400 });
    }

    // After multi-contact send, the queue row advances to the next draft. A blur/save from the
    // previous editor must not write the sent contact's body onto the next person's draft.
    if (requestedDraftId && requestedDraftId !== item.outreachDraftId) {
      return NextResponse.json(
        { skipped: true, reason: "draft_changed", draftId: item.outreachDraftId },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const targetDraftId = requestedDraftId || item.outreachDraftId;
    const existing = await getDraft(targetDraftId);
    if (!existing) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

    const draft = await updateDraftEdits(targetDraftId, { editedSubject, editedBody });
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
