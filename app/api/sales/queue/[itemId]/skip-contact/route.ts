import { NextResponse } from "next/server";
import { getDraft } from "@/lib/sales/db/outreach";
import { skipQueueContact } from "@/lib/sales/outreach/graduate-queue";

export const dynamic = "force-dynamic";

/**
 * Skip one contact — do not email them. Rejects their open draft.
 * If that was the last leftover contact, the org leaves the queue.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const contactId = typeof body?.contactId === "string" ? body.contactId : "";
    if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });

    const result = await skipQueueContact({
      itemId,
      contactId,
      decidedBy: typeof body?.decidedBy === "string" ? body.decidedBy : "operator",
    });
    const draft = result.nextDraftId ? await getDraft(result.nextDraftId) : null;
    return NextResponse.json({
      remaining: result.remaining,
      skippedContactId: result.skippedContactId,
      nextContactId: result.nextContactId,
      nextDraftId: result.nextDraftId,
      draft,
      graduated: result.graduated,
    });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status });
  }
}
