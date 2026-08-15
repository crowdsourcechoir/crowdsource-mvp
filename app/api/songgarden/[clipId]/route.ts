import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localSonggardenGetClip,
  localSonggardenRestoreOriginal,
} from "@/lib/local-songgarden-store";
import { encodeSupabaseBytea, decodeSupabaseBytea } from "@/lib/supabase-bytea";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

const CLIP_SELECT =
  "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at, trim_lead_ms, trim_trail_ms, trim_status, has_original";

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
 * PATCH: restore playable audio from stored original (untrimmed).
 * Body: { eventId, action: "restore_original" }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await context.params;
  let body: { eventId?: string; action?: string };
  try {
    body = (await request.json()) as { eventId?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  if (body.action !== "restore_original") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (USE_LOCAL_EVENTS) {
    const existing = await localSonggardenGetClip(eventId, clipId);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!existing.hasOriginal) {
      return NextResponse.json({ error: "No original stored for this clip." }, { status: 400 });
    }
    const clip = await localSonggardenRestoreOriginal(eventId, clipId);
    if (!clip) return NextResponse.json({ error: "Could not restore original." }, { status: 500 });
    return NextResponse.json({ clip });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("songgarden_clips")
      .select("audio_data_original, has_original, filename, mime_type")
      .eq("id", clipId)
      .eq("event_id", eventId)
      .single();
    if (error && /audio_data_original|has_original/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Original audio columns are not available yet. Run supabase/songgarden-trim-originals.sql in the Supabase SQL Editor.",
        },
        { status: 400 }
      );
    }
    if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!data.has_original || !data.audio_data_original) {
      return NextResponse.json({ error: "No original stored for this clip." }, { status: 400 });
    }

    const original = decodeSupabaseBytea(data.audio_data_original);
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("songgarden_clips")
      .update({
        audio_data: encodeSupabaseBytea(original),
        trim_lead_ms: 0,
        trim_trail_ms: 0,
        trim_status: "none",
        duration_ms: null,
      })
      .eq("id", clipId)
      .eq("event_id", eventId)
      .select(CLIP_SELECT)
      .single();
    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? "Update failed." }, { status: 500 });
    }
    return NextResponse.json({ clip: rowToClip(updated) });
  } catch (err) {
    console.error("Songgarden clip PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
