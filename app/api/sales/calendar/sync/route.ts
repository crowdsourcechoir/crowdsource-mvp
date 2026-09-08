import { NextResponse } from "next/server";
import { syncGoogleCalendar } from "@/lib/sales/calendar/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual calendar sync from Settings / Sales calendar. */
export async function POST() {
  try {
    const result = await syncGoogleCalendar();
    if (result.error && result.synced === 0) {
      return NextResponse.json({ result }, { status: 400 });
    }
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
