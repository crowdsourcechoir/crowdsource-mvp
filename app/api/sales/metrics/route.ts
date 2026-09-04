import { NextResponse } from "next/server";
import { loadFirstTouchSnapshot } from "@/lib/sales/db/first-touch-metrics";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** First-touch send / live-reply / bounce rates for the sales home dashboard. */
export async function GET() {
  try {
    const snapshot = await loadFirstTouchSnapshot();
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load outreach metrics") }, { status: 500 });
  }
}
