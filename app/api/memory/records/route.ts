import { NextResponse } from "next/server";
import { getLatestEventMemory, listEventMemoryRecords } from "@/lib/memory/finalize";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Fetch memory records — latest for eventId, or list with optional venue filter. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim() || null;
  const venue = searchParams.get("venue")?.trim() || null;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 100) : 50;

  const useLocal = process.env.USE_LOCAL_EVENTS === "true" || (eventId?.startsWith("local-") ?? false);
  if (!useLocal && !supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    if (eventId) {
      const record = await getLatestEventMemory(eventId, supabaseAdmin);
      if (!record) {
        return NextResponse.json({ error: "No memory record for this event." }, { status: 404 });
      }
      return NextResponse.json(record);
    }

    const records = await listEventMemoryRecords({ limit, venue }, supabaseAdmin);
    return NextResponse.json({ records });
  } catch (err) {
    console.error("Memory records GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
