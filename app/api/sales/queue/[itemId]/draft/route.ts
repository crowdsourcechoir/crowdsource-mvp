import { NextResponse } from "next/server";
import { getQueueItem } from "@/lib/sales/db/queue";
import { getDraft, saveDraftEdits } from "@/lib/sales/db/outreach";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

export const dynamic = "force-dynamic";

/**
 * Save edited subject/body on the queue item's draft without approving or launching.
 * Keeps the item pending so it can be reviewed/sent later; edits also feed draft learning.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const editedSubject = typeof body?.editedSubject === "string" ? body.editedSubject.trim() : "";
    const editedBodyRaw = typeof body?.editedBody === "string" ? body.editedBody : "";
    const editedBody = stripEmailSignature(editedBodyRaw).trim();

    if (!editedSubject || !editedBody) {
      return NextResponse.json({ error: "editedSubject and editedBody are required" }, { status: 400 });
    }

    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!item.outreachDraftId) {
      return NextResponse.json({ error: "No draft on this queue item" }, { status: 400 });
    }

    const draft = await saveDraftEdits(item.outreachDraftId, { editedSubject, editedBody });
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const item = await getQueueItem(itemId);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!item.outreachDraftId) return NextResponse.json({ draft: null });
    const draft = await getDraft(item.outreachDraftId);
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
