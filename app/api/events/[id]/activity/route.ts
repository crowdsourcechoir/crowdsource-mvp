import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localAgentParticipantActivity } from "@/lib/local-agent-interview-store";
import { localSonggardenActivity } from "@/lib/local-songgarden-store";

export const dynamic = "force-dynamic";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";
const RECENT_WINDOW_MINUTES = 10;

async function countSince(
  table: string,
  eventColumn: string,
  timeColumn: string,
  eventId: string,
  sinceIso: string
): Promise<{ total: number; recent: number }> {
  if (!supabaseAdmin) return { total: 0, recent: 0 };
  const [totalRes, recentRes] = await Promise.all([
    supabaseAdmin.from(table).select("*", { count: "exact", head: true }).eq(eventColumn, eventId),
    supabaseAdmin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(eventColumn, eventId)
      .gte(timeColumn, sinceIso),
  ]);
  return { total: totalRes.count ?? 0, recent: recentRes.count ?? 0 };
}

/**
 * Read-only, aggregate-only activity signal for one event — real participant/clip
 * counts, never individual content. Backs the "others are here too" ambient
 * presence ticker; the client blends in generic simulated lines only when this
 * reports near-zero recent activity (e.g. solo testing), per WorldConfig.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ error: "Event id is required." }, { status: 400 });
  }

  const sinceIso = new Date(Date.now() - RECENT_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    if (USE_LOCAL_EVENTS) {
      const [participants, clips] = await Promise.all([
        localAgentParticipantActivity(eventId, sinceIso),
        localSonggardenActivity(eventId, sinceIso),
      ]);
      return NextResponse.json({
        participantsTotal: participants.total,
        participantsRecent: participants.recent,
        clipsTotal: clips.total,
        clipsRecent: clips.recent,
        windowMinutes: RECENT_WINDOW_MINUTES,
      });
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { participantsTotal: 0, participantsRecent: 0, clipsTotal: 0, clipsRecent: 0, windowMinutes: RECENT_WINDOW_MINUTES }
      );
    }

    const [participants, clips] = await Promise.all([
      countSince("agent_participants", "event_id", "created_at", eventId, sinceIso),
      countSince("songgarden_clips", "event_id", "submitted_at", eventId, sinceIso),
    ]);

    return NextResponse.json({
      participantsTotal: participants.total,
      participantsRecent: participants.recent,
      clipsTotal: clips.total,
      clipsRecent: clips.recent,
      windowMinutes: RECENT_WINDOW_MINUTES,
    });
  } catch {
    // Ambient/best-effort signal — never block the experience on this failing.
    return NextResponse.json(
      { participantsTotal: 0, participantsRecent: 0, clipsTotal: 0, clipsRecent: 0, windowMinutes: RECENT_WINDOW_MINUTES }
    );
  }
}
