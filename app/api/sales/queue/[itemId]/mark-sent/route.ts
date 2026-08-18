import { NextResponse } from "next/server";
import { markContactSent } from "@/lib/sales/outreach/mark-contact-sent";

export const dynamic = "force-dynamic";

/**
 * Record that this contact was already emailed. Does not send.
 * Stays in Awareness and schedules a 7-day no-reply nudge.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const contactId = typeof body?.contactId === "string" ? body.contactId : "";
    if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });

    const result = await markContactSent({
      itemId,
      contactId,
      editedSubject: typeof body?.editedSubject === "string" ? body.editedSubject : undefined,
      editedBody: typeof body?.editedBody === "string" ? body.editedBody : undefined,
    });
    return NextResponse.json({
      ...result,
      sent: false,
      gmail: { sent: false },
    });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status });
  }
}
