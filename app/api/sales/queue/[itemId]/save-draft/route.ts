import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
import { getDraft, updateDraftEdits } from "@/lib/sales/db/outreach";
import { ensureQueueItemActionable } from "@/lib/sales/outreach/queue-actionable";

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

    const loaded = await getQueueItem(itemId);
    if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
    let item;
    try {
      item = await ensureQueueItemActionable(loaded);
    } catch (err) {
      const status = (err as Error & { status?: number }).status ?? 500;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status });
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
