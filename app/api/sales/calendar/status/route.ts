import { NextResponse } from "next/server";
import { getGmailConnectionStatus, getGmailConnection } from "@/lib/sales/db/gmail";
import {
  CALENDAR_SYNC_NEXT_DAYS,
  CALENDAR_SYNC_PAST_DAYS,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  hasCalendarReadonlyScope,
} from "@/lib/sales/calendar/constants";
import { readCalendarStore } from "@/lib/sales/calendar/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [status, connection, stored] = await Promise.all([
      getGmailConnectionStatus(),
      getGmailConnection().catch(() => null),
      readCalendarStore(),
    ]);

    const scopes = connection?.scopes ?? [];
    const googleScopes = scopes.filter((s) => !s.startsWith("csc:"));
    const calendarGranted = hasCalendarReadonlyScope(scopes);

    return NextResponse.json(
      {
        connected: status.connected,
        email: status.email,
        configured: status.configured,
        calendarGranted,
        requiredScope: GOOGLE_CALENDAR_READONLY_SCOPE,
        grantedScopes: googleScopes,
        window: {
          pastDays: CALENDAR_SYNC_PAST_DAYS,
          nextDays: CALENDAR_SYNC_NEXT_DAYS,
        },
        lastSyncedAt: stored.store.lastSyncedAt,
        lastSyncError: stored.store.lastSyncError ?? stored.error,
        eventCount: stored.store.events.filter((e) => e.status !== "cancelled").length,
        matchedCount: stored.store.events.filter((e) => e.matchStatus === "matched").length,
        unmatchedCount: stored.store.events.filter((e) => e.matchStatus === "unmatched").length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
