import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  AGENT_MEDIA_BUCKET,
  MAX_AGENT_AUDIO_BYTES,
  MAX_AGENT_VIDEO_BYTES,
  createAgentMediaSignedUpload,
  extForAgentMedia,
  newTurnMediaPath,
} from "@/lib/agent-media/storage-upload";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

type Ctx = { params: Promise<{ conversationId: string }> };

/**
 * Mint a signed upload URL for journey turn audio/video.
 * Client PUTs the blob, then sends storagePath + publicUrl on …/send.
 */
export async function POST(request: Request, context: Ctx) {
  const { conversationId } = await context.params;
  if (!conversationId?.trim()) {
    return NextResponse.json({ error: "conversationId is required." }, { status: 400, ...NO_STORE });
  }

  if (USE_LOCAL_EVENTS) {
    return NextResponse.json(
      { error: "Direct media upload is not used in local-events mode." },
      { status: 501, ...NO_STORE }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503, ...NO_STORE });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      kind?: string;
      size?: number;
      contentType?: string;
      ext?: string;
    };

    const kind = body.kind === "video" ? "video" : body.kind === "audio" ? "audio" : null;
    if (!kind) {
      return NextResponse.json({ error: "kind must be audio or video." }, { status: 400, ...NO_STORE });
    }

    const size = Number(body.size) || 0;
    const maxBytes = kind === "video" ? MAX_AGENT_VIDEO_BYTES : MAX_AGENT_AUDIO_BYTES;
    if (size <= 0 || size > maxBytes) {
      return NextResponse.json(
        {
          error: `${kind} must be 1 byte – ${maxBytes} bytes (got ${size}).`,
        },
        { status: 400, ...NO_STORE }
      );
    }

    const { data: conv, error: convErr } = await supabaseAdmin
      .from("agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr) {
      return NextResponse.json({ error: convErr.message }, { status: 500, ...NO_STORE });
    }
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404, ...NO_STORE });
    }

    const contentType =
      typeof body.contentType === "string" && body.contentType.trim()
        ? body.contentType.trim()
        : kind === "video"
          ? "video/webm"
          : "audio/wav";

    const ext =
      typeof body.ext === "string" && /^[a-z0-9]{1,8}$/i.test(body.ext.trim())
        ? body.ext.trim().toLowerCase()
        : extForAgentMedia(contentType, kind);

    const path = newTurnMediaPath(conversationId, kind, ext);
    const upload = await createAgentMediaSignedUpload(path);

    return NextResponse.json(
      {
        upload,
        bucket: AGENT_MEDIA_BUCKET,
        maxBytes,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
