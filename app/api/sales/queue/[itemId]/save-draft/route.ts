import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
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

    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Queue item already decided." }, { status: 409 });
    }
    if (!item.outreachDraftId) {
      return NextResponse.json({ error: "No draft on this queue item." }, { status: 400 });
    }

    const existing = await getDraft(item.outreachDraftId);
    if (!existing) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

    const draft = await updateDraftEdits(item.outreachDraftId, { editedSubject, editedBody });
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
