import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localSonggardenReadAudio } from "@/lib/local-songgarden-store";
import { decodeSupabaseBytea } from "@/lib/supabase-bytea";
import { clipStoragePublicUrl } from "@/lib/songgarden/storage-upload";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

export async function GET(
  request: Request,
  context: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await context.params;
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const wantOriginal = searchParams.get("original") === "1" || searchParams.get("original") === "true";

  const jsonError = (error: string, status: number) =>
    NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

  if (!eventId) {
    return jsonError("eventId is required.", 400);
  }

  if (USE_LOCAL_EVENTS) {
    const result = await localSonggardenReadAudio(eventId, clipId, { original: wantOriginal });
    if (!result) return jsonError("Not found.", 404);
    const filename = wantOriginal
      ? result.clip.filename.replace(/(\.[^.]+)?$/, ".original$1")
      : result.clip.filename;
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.clip.mimeType || "audio/wav",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
        "X-Songgarden-Audio": wantOriginal ? "original" : "playable",
      },
    });
  }

  if (!supabaseAdmin) {
    return jsonError("Database not configured.", 503);
  }

  try {
    let data: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;

    if (wantOriginal) {
      const full = await supabaseAdmin
        .from("songgarden_clips")
        .select(
          "filename, mime_type, audio_data, audio_data_original, has_original, audio_storage_path, audio_original_storage_path"
        )
        .eq("id", clipId)
        .eq("event_id", eventId)
        .single();
      if (full.error && /audio_data_original|has_original|audio_storage_path/i.test(full.error.message)) {
        return jsonError("Audio columns not available yet. Run supabase migrations.", 404);
      }
      data = (full.data as Record<string, unknown> | null) ?? null;
      error = full.error;
    } else {
      const playable = await supabaseAdmin
        .from("songgarden_clips")
        .select("filename, mime_type, audio_data, audio_storage_path")
        .eq("id", clipId)
        .eq("event_id", eventId)
        .single();
      data = (playable.data as Record<string, unknown> | null) ?? null;
      error = playable.error;
    }

    if (error || !data) return jsonError("Not found.", 404);

    const row = data;
    const storagePath = wantOriginal
      ? (row.audio_original_storage_path as string | null)
      : (row.audio_storage_path as string | null);

    if (storagePath?.trim()) {
      const url = clipStoragePublicUrl(storagePath.trim());
      if (url) {
        return NextResponse.redirect(url, {
          status: 302,
          headers: {
            "Cache-Control": "public, max-age=3600",
            "X-Songgarden-Audio": wantOriginal ? "original" : "playable",
          },
        });
      }
    }

    let buffer: Buffer;
    if (wantOriginal) {
      if (!row.audio_data_original) {
        return jsonError("No original audio stored for this clip.", 404);
      }
      buffer = decodeSupabaseBytea(row.audio_data_original);
    } else {
      if (!row.audio_data) {
        return jsonError("Audio not found.", 404);
      }
      buffer = decodeSupabaseBytea(row.audio_data);
    }

    if (buffer.length === 0) {
      return jsonError("Audio data is empty.", 404);
    }

    const filename = String(row.filename ?? "clip.wav");
    const outName = wantOriginal
      ? filename.replace(/(\.[^.]+)?$/, ".original$1")
      : filename;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": (row.mime_type as string) || "audio/wav",
        "Content-Disposition": `inline; filename="${outName}"`,
        "Cache-Control": "public, max-age=3600",
        "X-Songgarden-Audio": wantOriginal ? "original" : "playable",
      },
    });
  } catch (err) {
    console.error("Songgarden audio GET error:", err);
    return jsonError(err instanceof Error ? err.message : "Server error", 500);
  }
}
