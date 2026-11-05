import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { rowToSubmission } from "@/lib/live-prompt-game/rows";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { id: sessionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("round_id");
  try {
    let q = supabaseAdmin
      .from("prompt_game_submissions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (roundId) q = q.eq("round_id", roundId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToSubmission));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { id: sessionId } = await context.params;
  try {
    const body = await request.json();
    const round_id = body.round_id;
    const device_id = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const raw_text = typeof body.raw_text === "string" ? body.raw_text.trim() : "";
    if (!round_id || !device_id) {
      return NextResponse.json({ error: "round_id and device_id required." }, { status: 400 });
    }
    if (!raw_text) {
      return NextResponse.json({ error: "raw_text required." }, { status: 400 });
    }
    const row = { session_id: sessionId, round_id, device_id, raw_text };
    const { data, error } = await supabaseAdmin
      .from("prompt_game_submissions")
      .insert(row)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToSubmission(data));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
