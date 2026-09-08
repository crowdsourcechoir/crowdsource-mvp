import { NextResponse } from "next/server";
import { listCalendarEvents, readCalendarStore } from "@/lib/sales/calendar/store";

export const dynamic = "force-dynamic";

/** List synced meetings for the Sales calendar view. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchedOnly = searchParams.get("matched") === "1";
    const contactId = searchParams.get("contactId");
    const opportunityId = searchParams.get("opportunityId");

    const { store, error } = await readCalendarStore();
    let events = await listCalendarEvents({ matchedOnly });

    if (contactId) {
      events = events.filter((e) => e.contactId === contactId);
    }
    if (opportunityId) {
      events = events.filter((e) => e.opportunityId === opportunityId);
    }

    return NextResponse.json(
      {
        events,
        lastSyncedAt: store.lastSyncedAt,
        lastSyncError: store.lastSyncError ?? error,
        window: store.window,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
