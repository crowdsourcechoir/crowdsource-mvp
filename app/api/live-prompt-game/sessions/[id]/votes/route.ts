import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("round_id");
  const deviceId = searchParams.get("device_id");
  try {
    if (roundId && deviceId) {
      const { data: votes, error: votesErr } = await supabaseAdmin
        .from("prompt_game_votes")
        .select("submission_id")
        .eq("session_id", sessionId)
        .eq("round_id", roundId)
        .eq("device_id", deviceId);
      if (votesErr) return NextResponse.json({ error: votesErr.message }, { status: 500 });
      const ids = (votes ?? []).map((v) => v.submission_id);
      return NextResponse.json(ids);
    }
    return NextResponse.json({ error: "round_id and device_id required for my votes." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
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
    const body = await request.json();
    const round_id = body.round_id;
    const submission_id = body.submission_id;
    const device_id = typeof body.device_id === "string" ? body.device_id.trim() : "";
    if (!round_id || !submission_id || !device_id) {
      return NextResponse.json({ error: "round_id, submission_id, device_id required." }, { status: 400 });
    }
    const { count } = await supabaseAdmin
      .from("prompt_game_votes")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("round_id", round_id)
      .eq("device_id", device_id);
    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: "Maximum 3 votes per round." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("prompt_game_votes").insert({
      session_id: sessionId,
      round_id,
      submission_id,
      device_id,
    });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Already voted for this phrase." }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
