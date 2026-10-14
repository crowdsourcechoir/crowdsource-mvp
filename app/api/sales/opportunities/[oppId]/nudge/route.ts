import { NextResponse } from "next/server";
import { generateNudgeDraftForOpportunityContact } from "@/lib/sales/gmail/nudge";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Draft a follow-up ("hey, did you get this?") for a contact on this opportunity now.
 * Bypasses the 7-day due window; still caps at MAX_NUDGES and won't duplicate a pending nudge.
 * Returns the new pending queue item id so the UI can jump to it for review/send.
 */
export async function POST(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const body = await request.json().catch(() => ({}));
    const contactId = typeof body?.contactId === "string" ? body.contactId.trim() : "";
    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }
    const result = await generateNudgeDraftForOpportunityContact(oppId, contactId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      queueItemId: result.queueItemId,
      draftId: result.draftId,
      contactId: result.contactId,
    });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Could not draft follow-up") }, { status: 500 });
  }
}
