import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { parsePromptBlock } from "@/data/signalPromptBlock";
import {
  createLiveMediaSignedUpload,
  maxBytesForMediaType,
  newLiveMediaObjectPath,
} from "@/lib/live-prompt-game/media-storage";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

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
      byte_size?: number;
      content_type?: string;
      ext?: string;
    };

    const roundId = typeof body.round_id === "string" ? body.round_id.trim() : "";
    const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const mediaType = body.media_type;
    if (!roundId || !deviceId) {
      return NextResponse.json({ error: "round_id and device_id required." }, { status: 400, ...NO_STORE });
    }
    if (mediaType !== "photo" && mediaType !== "sound" && mediaType !== "video") {
      return NextResponse.json({ error: "media_type must be photo, sound, or video." }, { status: 400, ...NO_STORE });
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

    const maxBytes = maxBytesForMediaType(mediaType);
    const byteSize = Number(body.byte_size) || 0;
    if (byteSize <= 0 || byteSize > maxBytes) {
      return NextResponse.json(
        { error: `File must be 1 byte – ${maxBytes} bytes.` },
        { status: 400, ...NO_STORE }
      );
    }

    const defaultExt = mediaType === "photo" ? "jpg" : mediaType === "sound" ? "wav" : "webm";
    const ext =
      typeof body.ext === "string" && /^[a-z0-9]{1,8}$/i.test(body.ext.trim())
        ? body.ext.trim().toLowerCase()
        : defaultExt;
    const contentType =
      typeof body.content_type === "string" && body.content_type.trim()
        ? body.content_type.trim()
        : mediaType === "photo"
          ? "image/jpeg"
          : "audio/wav";

    const path = newLiveMediaObjectPath({
      sessionId,
      eventId: (session.linked_event_id as string | null) ?? null,
      mediaType,
      ext,
    });
    const upload = await createLiveMediaSignedUpload(path);

    return NextResponse.json(
      {
        upload,
        maxBytes,
        contentType,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
