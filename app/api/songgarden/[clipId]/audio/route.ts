import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localSonggardenReadAudio } from "@/lib/local-songgarden-store";
import { decodeSupabaseBytea } from "@/lib/supabase-bytea";
import {
  downloadClipObject,
  ensureParticipantClipsBucket,
} from "@/lib/songgarden/storage-upload";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

function audioResponse(
  buffer: Buffer,
  opts: { mimeType: string; filename: string; wantOriginal: boolean }
) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": opts.mimeType || "audio/wav",
      "Content-Disposition": `inline; filename="${opts.filename}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Songgarden-Audio": opts.wantOriginal ? "original" : "playable",
      "Content-Length": String(buffer.length),
    },
  });
}

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
    return audioResponse(Buffer.from(result.buffer), {
      mimeType: result.clip.mimeType || "audio/wav",
      filename,
      wantOriginal,
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
          "filename, mime_type, has_original, audio_storage_path, audio_original_storage_path, audio_data, audio_data_original"
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
      // Prefer storage path first so we can stream without pulling bytea.
      const light = await supabaseAdmin
        .from("songgarden_clips")
        .select("filename, mime_type, audio_storage_path")
        .eq("id", clipId)
        .eq("event_id", eventId)
        .single();
      if (!light.error && light.data?.audio_storage_path) {
        data = light.data as Record<string, unknown>;
        error = null;
      } else if (light.error && /audio_storage_path/i.test(light.error.message)) {
        const legacy = await supabaseAdmin
          .from("songgarden_clips")
          .select("filename, mime_type, audio_data")
          .eq("id", clipId)
          .eq("event_id", eventId)
          .single();
        data = (legacy.data as Record<string, unknown> | null) ?? null;
        error = legacy.error;
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
    }

    if (error || !data) return jsonError("Not found.", 404);

    const row = data;
    const storagePath = wantOriginal
      ? (row.audio_original_storage_path as string | null)
      : (row.audio_storage_path as string | null);

    const filename = String(row.filename ?? "clip.wav");
    const outName = wantOriginal
      ? filename.replace(/(\.[^.]+)?$/, ".original$1")
      : filename;
    const mimeType = (row.mime_type as string) || "audio/wav";

    // Stream via service role instead of 302 to a public URL. Public redirects fail when the
    // bucket is private (or object missing from CDN), which surfaces as "Could not load audio".
    if (storagePath?.trim()) {
      await ensureParticipantClipsBucket();
      const downloaded = await downloadClipObject(storagePath.trim());
      if (downloaded) {
        return audioResponse(downloaded.buffer, {
          mimeType: downloaded.contentType || mimeType,
          filename: outName,
          wantOriginal,
        });
      }
      // Fall through to bytea if the object is gone from storage but still in the row.
    }

    let buffer: Buffer;
    if (wantOriginal) {
      if (!row.audio_data_original) {
        return jsonError(
          storagePath?.trim()
            ? "Stored audio file missing from storage."
            : "No original audio stored for this clip.",
          404
        );
      }
      buffer = decodeSupabaseBytea(row.audio_data_original);
    } else {
      if (!row.audio_data) {
        return jsonError(
          storagePath?.trim() ? "Stored audio file missing from storage." : "Audio not found.",
          404
        );
      }
      buffer = decodeSupabaseBytea(row.audio_data);
    }

    if (buffer.length === 0) {
      return jsonError("Audio data is empty.", 404);
    }

    return audioResponse(buffer, { mimeType, filename: outName, wantOriginal });
  } catch (err) {
    console.error("Songgarden audio GET error:", err);
    return jsonError(err instanceof Error ? err.message : "Server error", 500);
  }
}
