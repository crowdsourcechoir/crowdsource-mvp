import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { listGardens } from "@/lib/song-garden-v2/garden/store";
import { localSonggardenList } from "@/lib/local-songgarden-store";
import { localEventsGetAll } from "@/lib/local-events-store";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

export const dynamic = "force-dynamic";

const USE_LOCAL = process.env.USE_LOCAL_EVENTS === "true";

const CLIP_SELECT =
  "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at, trim_lead_ms, trim_trail_ms, trim_status, has_original";
const CLIP_SELECT_LEGACY =
  "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at";

/** Map legacy / seed labels onto current category ids. */
function normalizeCategory(raw: unknown): SonggardenCategoryId {
  const value = String(raw ?? "other").toLowerCase();
  if (
    value === "ambient" ||
    value === "foley" ||
    value === "percussion" ||
    value === "vocal" ||
    value === "texture" ||
    value === "other"
  ) {
    return value;
  }
  if (value === "percussive" || value === "drums" || value === "beat") return "percussion";
  if (value === "melody" || value === "harmony" || value === "musical") return "texture";
  return "other";
}

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
    category: normalizeCategory(row.category),
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

function isTrimSchemaMissing(message: string): boolean {
  return /trim_lead_ms|trim_trail_ms|trim_status|has_original|audio_data_original/i.test(message);
}

/**
 * Master Composer library — every Song Garden sound across blooms/gardens.
 */
export async function GET() {
  try {
    if (USE_LOCAL) {
      const events = localEventsGetAll();
      const clips: SonggardenClip[] = [];
      for (const ev of events.slice(0, 80)) {
        const list = await localSonggardenList(String(ev.id));
        clips.push(
          ...list.map((clip) => ({
            ...clip,
            category: normalizeCategory(clip.category),
          }))
        );
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
      return NextResponse.json(
        { clips: [], gardens: [], events: [], error: "Database not configured." },
        { status: 503 }
      );
    }

    let data: Record<string, unknown>[] | null = null;
    let error: { message: string } | null = null;

    const primary = await supabaseAdmin
      .from("songgarden_clips")
      .select(CLIP_SELECT)
      .order("submitted_at", { ascending: false })
      .limit(2000);
    data = (primary.data as Record<string, unknown>[] | null) ?? null;
    error = primary.error;

    if (error && isTrimSchemaMissing(error.message)) {
      const legacy = await supabaseAdmin
        .from("songgarden_clips")
        .select(CLIP_SELECT_LEGACY)
        .order("submitted_at", { ascending: false })
        .limit(2000);
      data = (legacy.data as Record<string, unknown>[] | null) ?? null;
      error = legacy.error;
    }

    if (error) {
      console.warn("[composer/library]", error.message);
      return NextResponse.json(
        { clips: [], gardens: [], events: [], error: error.message },
        { status: 500 }
      );
    }

    const clips = (data ?? []).map((r) => rowToClip(r));
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
    return NextResponse.json(
      {
        clips: [],
        gardens: [],
        events: [],
        error: err instanceof Error ? err.message : "Library failed.",
      },
      { status: 500 }
    );
  }
}
