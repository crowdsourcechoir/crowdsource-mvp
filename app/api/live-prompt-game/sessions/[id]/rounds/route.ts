import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function rowToRound(row: Record<string, unknown>) {
  return {
    id: row.id,
    session_id: row.session_id,
    prompt_text: row.prompt_text,
    response_type: row.response_type ?? "short_phrase",
    character_limit: row.character_limit ?? 140,
    timer_seconds: row.timer_seconds ?? null,
    created_at: row.created_at,
    closed_at: row.closed_at ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from("prompt_game_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToRound));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId } = await params;
  try {
    const body = await request.json();
    const prompt_text = typeof body.prompt_text === "string" ? body.prompt_text.trim() : "";
    if (!prompt_text) {
      return NextResponse.json({ error: "prompt_text is required." }, { status: 400 });
    }
    const response_type = ["one_word", "short_phrase", "sentence"].includes(body.response_type)
      ? body.response_type
      : "short_phrase";
    const character_limit = typeof body.character_limit === "number" ? body.character_limit : 140;
    const timer_seconds = body.timer_seconds != null ? Number(body.timer_seconds) : null;

    const row = {
      session_id: sessionId,
      prompt_text,
      response_type,
      character_limit,
      timer_seconds,
    };
    const { data: round, error: insertError } = await supabaseAdmin
      .from("prompt_game_rounds")
      .insert(row)
      .select()
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    await supabaseAdmin
      .from("prompt_game_sessions")
      .update({ state: "RESPONDING", current_round_id: round.id })
      .eq("id", sessionId);

    return NextResponse.json(rowToRound(round));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
