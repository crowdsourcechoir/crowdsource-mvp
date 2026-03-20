import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await context.params;

  try {
    const { data, error } = await supabaseAdmin
      .from("prompt_game_ai_outputs")
      .select("id, kind, payload, created_at")
      .eq("session_id", sessionId)
      .eq("kind", "song_pack")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "No Song Pack generated yet." }, { status: 404 });
    }
    return NextResponse.json(data.payload);
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
