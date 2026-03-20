import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localGetLatestSongSeedForEvent } from "@/lib/local-song-seeds-store";

function rowToSongSeed(row: Record<string, unknown>) {
  return {
    id: row.id,
    eventId: row.event_id,
    topThemes: Array.isArray(row.top_themes) ? row.top_themes : [],
    notableLines: Array.isArray(row.notable_lines) ? row.notable_lines : [],
    singableHooks: Array.isArray(row.singable_hooks) ? row.singable_hooks : [],
    shoutouts: Array.isArray(row.shoutouts) ? row.shoutouts : [],
    emotionalToneSummary: (row.emotional_tone_summary as string) ?? "",
    sourceMapping: Array.isArray(row.source_mapping) ? row.source_mapping : [],
    sunoPrompts: Array.isArray(row.suno_prompts) ? row.suno_prompts : [],
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const useLocal = process.env.USE_LOCAL_EVENTS === "true";

  if (useLocal) {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }
    const seed = await localGetLatestSongSeedForEvent(eventId);
    if (!seed) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(seed);
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("song_seeds")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(rowToSongSeed(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
