import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { parsePromptBlock } from "@/data/signalPromptBlock";
import { rowToSubmission } from "@/lib/live-prompt-game/rows";
import {
  clipStoragePublicUrl,
  liveSessionGardenLabel,
  verifyClipObject,
  maxBytesForMediaType,
} from "@/lib/live-prompt-game/media-storage";
import {
  kindFromSonggardenCategory,
  recordGardenContribution,
} from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

async function landInGarden(args: {
  eventId: string;
  sessionSlug: string;
  sessionId: string;
  mediaType: "photo" | "sound" | "video";
  mediaPath: string;
  mediaMime: string;
  durationMs: number | null;
  deviceId: string;
}): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const label = liveSessionGardenLabel({
    sessionSlug: args.sessionSlug,
    mediaType: args.mediaType,
  });
  const category = args.mediaType === "sound" ? "percussion" : "other";
  const ext = args.mediaPath.split(".").pop() || (args.mediaType === "photo" ? "jpg" : "wav");
  const filename = `live-${args.mediaType}.${ext}`.replace(/[^a-zA-Z0-9._-]+/g, "_");

  const insertRow: Record<string, unknown> = {
    event_id: args.eventId,
    contributor_name: null,
    label,
    category,
    filename,
    mime_type: args.mediaMime,
    duration_ms: args.durationMs,
    device_id: args.deviceId,
    session_token: `live:${args.sessionId}`,
    audio_data: null,
    audio_storage_path: args.mediaPath,
    audio_original_storage_path: null,
    trim_status: "none",
    has_original: false,
  };

  let { data, error } = await supabaseAdmin
    .from("songgarden_clips")
    .insert(insertRow)
    .select("id")
    .single();

  if (error && /trim_status|has_original|audio_original/i.test(error.message)) {
    const {
      trim_status: _t,
      has_original: _h,
      audio_original_storage_path: _o,
      ...slim
    } = insertRow;
    const retry = await supabaseAdmin.from("songgarden_clips").insert(slim).select("id").single();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data?.id) {
    console.error("live media garden land failed:", error?.message);
    return null;
  }

  const clipId = String(data.id);
  try {
    await recordGardenContribution({
      eventId: args.eventId,
      kind: kindFromSonggardenCategory(category),
      sourceType: "clip",
      sourceId: clipId,
      deviceId: args.deviceId,
    });
  } catch (err) {
    console.error("live media garden contribution failed:", err);
  }
  return clipId;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503, ...NO_STORE });
  }
  const { id: sessionId } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      round_id?: string;
      device_id?: string;
      media_type?: string;
      media_path?: string;
      media_mime?: string;
      media_duration_ms?: number | null;
      consent_accepted?: boolean;
    };

    const roundId = typeof body.round_id === "string" ? body.round_id.trim() : "";
    const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const mediaType = body.media_type;
    const mediaPath = typeof body.media_path === "string" ? body.media_path.trim() : "";
    if (!roundId || !deviceId || !mediaPath) {
      return NextResponse.json(
        { error: "round_id, device_id, and media_path required." },
        { status: 400, ...NO_STORE }
      );
    }
    if (mediaType !== "photo" && mediaType !== "sound" && mediaType !== "video") {
      return NextResponse.json({ error: "Invalid media_type." }, { status: 400, ...NO_STORE });
    }
    if (!body.consent_accepted) {
      return NextResponse.json(
        { error: "Room consent is required before submitting media." },
        { status: 403, ...NO_STORE }
      );
    }
    if (!mediaPath.startsWith("clips/") || !mediaPath.includes("/live/")) {
      return NextResponse.json({ error: "Invalid media_path." }, { status: 400, ...NO_STORE });
    }

    const [{ data: session, error: sessionErr }, { data: round, error: roundErr }] = await Promise.all([
      supabaseAdmin.from("prompt_game_sessions").select("*").eq("id", sessionId).single(),
      supabaseAdmin.from("prompt_game_rounds").select("*").eq("id", roundId).eq("session_id", sessionId).single(),
    ]);
    if (sessionErr || !session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404, ...NO_STORE });
    }
    if (roundErr || !round) {
      return NextResponse.json({ error: "Round not found." }, { status: 404, ...NO_STORE });
    }
    if (session.state !== "RESPONDING" || session.current_round_id !== roundId) {
      return NextResponse.json({ error: "Media submissions are closed for this round." }, { status: 409, ...NO_STORE });
    }
    const block = parsePromptBlock(round.prompt_block);
    if (!block || block.kind !== "media" || block.mediaType !== mediaType) {
      return NextResponse.json({ error: "This round is not accepting that media type." }, { status: 409, ...NO_STORE });
    }

    const ok = await verifyClipObject(mediaPath, maxBytesForMediaType(mediaType));
    if (!ok) {
      return NextResponse.json(
        { error: "Upload not found. Complete the Storage PUT before confirm." },
        { status: 400, ...NO_STORE }
      );
    }

    const mediaMime =
      typeof body.media_mime === "string" && body.media_mime.trim()
        ? body.media_mime.trim()
        : mediaType === "photo"
          ? "image/jpeg"
          : "audio/wav";
    const durationMs =
      body.media_duration_ms != null && Number.isFinite(Number(body.media_duration_ms))
        ? Number(body.media_duration_ms)
        : null;
    const mediaUrl = clipStoragePublicUrl(mediaPath);
    const displayMode = session.display_mode === "approve_first" ? "approve_first" : "auto";
    const approved = displayMode === "auto";
    const rawText = mediaType === "photo" ? "[selfie]" : mediaType === "sound" ? "[snap]" : "[video]";

    let gardenClipId: string | null = null;
    const linkedEventId =
      typeof session.linked_event_id === "string" ? session.linked_event_id : null;
    if (linkedEventId) {
      gardenClipId = await landInGarden({
        eventId: linkedEventId,
        sessionSlug: String(session.slug),
        sessionId,
        mediaType,
        mediaPath,
        mediaMime,
        durationMs,
        deviceId,
      });
    }

    const insertRow: Record<string, unknown> = {
      session_id: sessionId,
      round_id: roundId,
      device_id: deviceId,
      raw_text: rawText,
      media_type: mediaType,
      media_url: mediaUrl,
      media_path: mediaPath,
      media_mime: mediaMime,
      media_duration_ms: durationMs,
      approved,
      garden_clip_id: gardenClipId,
      live_consent_at: new Date().toISOString(),
      hidden: false,
      locked: false,
    };

    let { data, error } = await supabaseAdmin
      .from("prompt_game_submissions")
      .insert(insertRow)
      .select()
      .single();

    if (error && /media_type|media_url|approved|garden_clip|live_consent/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Live media needs the SQL migration. Run supabase/live-media-moments.sql in Supabase, then retry.",
          detail: error.message,
        },
        { status: 503, ...NO_STORE }
      );
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, ...NO_STORE });
    }

    return NextResponse.json(rowToSubmission(data), NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
