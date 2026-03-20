import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; roundId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId, roundId } = await context.params;
  try {
    const body = await request.json();
    if (body.closed_at === undefined) {
      return NextResponse.json({ error: "closed_at required." }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("prompt_game_rounds")
      .update({ closed_at: body.closed_at })
      .eq("id", roundId)
      .eq("session_id", sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
