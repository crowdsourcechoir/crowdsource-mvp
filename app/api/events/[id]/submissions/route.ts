import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localEventsGetById } from "@/lib/local-events-store";
import { wipeEventSubmissions } from "@/lib/event-submissions-wipe";

export const dynamic = "force-dynamic";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ error: "Event id is required." }, { status: 400 });
  }

  if (USE_LOCAL_EVENTS) {
    if (!localEventsGetById(eventId)) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
  } else if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from("events").select("id").eq("id", eventId).single();
    if (error || !data) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const deleted = await wipeEventSubmissions(eventId);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Wipe failed." },
      { status: 500 }
    );
  }
}
