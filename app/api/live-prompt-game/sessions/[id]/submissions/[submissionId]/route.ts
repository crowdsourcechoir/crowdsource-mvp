import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; submissionId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: sessionId, submissionId } = await context.params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.hidden === "boolean") updates.hidden = body.hidden;
    if (typeof body.locked === "boolean") updates.locked = body.locked;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "hidden or locked required." }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("prompt_game_submissions")
      .update(updates)
      .eq("id", submissionId)
      .eq("session_id", sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
