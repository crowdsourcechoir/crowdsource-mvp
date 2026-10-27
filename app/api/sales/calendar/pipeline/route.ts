import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { loadPipelineScheduleEvents } from "@/lib/sales/calendar/pipeline-schedule";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Opportunities with event_date_estimate — for the pipeline schedule calendar. */
export async function GET() {
  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const events = await loadPipelineScheduleEvents();
    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    return NextResponse.json(
      { error: publicErrorMessage(err, "Failed to load pipeline schedule") },
      { status: 500 }
    );
  }
}
