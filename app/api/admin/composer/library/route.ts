import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { listGardens } from "@/lib/song-garden-v2/garden/store";
import { localSonggardenList } from "@/lib/local-songgarden-store";
import { localEventsGetAll } from "@/lib/local-events-store";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

export const dynamic = "force-dynamic";

const USE_LOCAL = process.env.USE_LOCAL_EVENTS === "true";

function rowToClip(row: Record<string, unknown>): SonggardenClip {
  const trimStatus =
    row.trim_status === "trimmed" || row.trim_status === "skipped" || row.trim_status === "none"
      ? row.trim_status
      : "none";
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    contributorName: row.contributor_name != null ? String(row.contributor_name) : null,
    label: row.label != null ? String(row.label) : null,
    category: row.category as SonggardenCategoryId,
    filename: String(row.filename),
    mimeType: String(row.mime_type ?? "audio/wav"),
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    deviceId: row.device_id != null ? String(row.device_id) : "",
    sessionToken: row.session_token != null ? String(row.session_token) : null,
    submittedAt: String(row.submitted_at),
    trimLeadMs: row.trim_lead_ms != null ? Number(row.trim_lead_ms) : null,
    trimTrailMs: row.trim_trail_ms != null ? Number(row.trim_trail_ms) : null,
    trimStatus,
    hasOriginal: Boolean(row.has_original),
  };
}

/**
 * Master Composer library — all Song Garden sounds across blooms/gardens.
 * Admin composer only; keep payload bounded.
 */
export async function GET() {
  try {
    if (USE_LOCAL) {
      const events = localEventsGetAll();
      const clips: SonggardenClip[] = [];
      for (const ev of events.slice(0, 80)) {
        const list = await localSonggardenList(String(ev.id));
        clips.push(...list);
      }
      const gardens = await listGardens();
      return NextResponse.json({
        clips,
        gardens: gardens.map((g) => ({ id: g.id, slug: g.slug, title: g.title })),
        events: events.map((e) => ({
          id: String(e.id),
          slug: String(e.slug ?? ""),
          title: String(e.title ?? "Untitled"),
        })),
      });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ clips: [], gardens: [], events: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("songgarden_clips")
      .select(
        "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at, trim_lead_ms, trim_trail_ms, trim_status, has_original"
      )
      .order("submitted_at", { ascending: false })
      .limit(2000);

    if (error) {
      console.warn("[composer/library]", error.message);
      return NextResponse.json({ clips: [], gardens: [], events: [] });
    }

    const clips = (data ?? []).map((r) => rowToClip(r as Record<string, unknown>));
    const gardens = await listGardens();
    const { data: eventRows } = await supabaseAdmin
      .from("events")
      .select("id, slug, title")
      .order("created_at", { ascending: false })
      .limit(500);

    return NextResponse.json({
      clips,
      gardens: gardens.map((g) => ({ id: g.id, slug: g.slug, title: g.title })),
      events: (eventRows ?? []).map((e) => ({
        id: String(e.id),
        slug: String(e.slug ?? ""),
        title: String(e.title ?? "Untitled"),
      })),
    });
  } catch (err) {
    console.warn("[composer/library]", err);
    return NextResponse.json({ clips: [], gardens: [], events: [] });
  }
}
