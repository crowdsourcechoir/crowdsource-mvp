import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localSonggardenReadAudio } from "@/lib/local-songgarden-store";
import { decodeSupabaseBytea, encodeSupabaseBytea } from "@/lib/supabase-bytea";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

export async function GET(
  request: Request,
  context: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await context.params;
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  if (USE_LOCAL_EVENTS) {
    const result = await localSonggardenReadAudio(eventId, clipId);
    if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.clip.mimeType || "audio/wav",
        "Content-Disposition": `inline; filename="${result.clip.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("songgarden_clips")
      .select("filename, mime_type, audio_data")
      .eq("id", clipId)
      .eq("event_id", eventId)
      .single();
    if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const buffer = decodeSupabaseBytea(data.audio_data);
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Audio data is empty." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": (data.mime_type as string) || "audio/wav",
        "Content-Disposition": `inline; filename="${data.filename as string}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Songgarden audio GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
