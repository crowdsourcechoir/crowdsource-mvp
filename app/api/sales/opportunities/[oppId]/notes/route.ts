import { NextResponse } from "next/server";
import { createOutreachActivity, listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { getOpportunity } from "@/lib/sales/db/opportunities";

export const dynamic = "force-dynamic";

/** List note activities for this opportunity (newest first). */
export async function GET(_request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const opportunity = await getOpportunity(oppId);
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const activities = await listActivitiesForOpportunity(oppId);
    const notes = activities
      .filter((a) => a.activityType === "note")
      .map((a) => ({
        id: a.id,
        text: typeof a.metadata?.text === "string" ? a.metadata.text : "",
        occurredAt: a.occurredAt,
      }))
      .filter((n) => n.text.trim());
    return NextResponse.json({ notes }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

/** Append a freeform operator note on this opportunity. */
export async function POST(request: Request, { params }: { params: Promise<{ oppId: string }> }) {
  try {
    const { oppId } = await params;
    const opportunity = await getOpportunity(oppId);
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
    if (text.length > 4000) return NextResponse.json({ error: "Note is too long (max 4000)." }, { status: 400 });

    const activity = await createOutreachActivity({
      opportunityId: oppId,
      contactId: typeof body?.contactId === "string" ? body.contactId : null,
      activityType: "note",
      metadata: { text },
    });
    return NextResponse.json({
      note: {
        id: activity.id,
        text,
        occurredAt: activity.occurredAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
