import { NextResponse } from "next/server";
import { finalizeEventMemory } from "@/lib/memory/finalize";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 60;

/** Assemble and persist an Event Memory Record for an event. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      eventId?: string;
      finalizedBy?: "joel" | "system";
    };

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }

    const finalizedBy = body.finalizedBy === "system" ? "system" : "joel";

    const useLocal = process.env.USE_LOCAL_EVENTS === "true" || eventId.startsWith("local-");
    if (!useLocal && !supabaseAdmin) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    const record = await finalizeEventMemory({ eventId, finalizedBy }, supabaseAdmin);
    return NextResponse.json(record);
  } catch (err) {
    console.error("Memory finalize error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
