import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { rowToSession } from "@/lib/live-prompt-game/rows";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { id } = await context.params;
  try {
    const { data, error } = await supabaseAdmin
      .from("prompt_game_sessions")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(rowToSession(data));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { id } = await context.params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.state !== undefined) updates.state = body.state;
    if (body.current_round_id !== undefined) updates.current_round_id = body.current_round_id;
    if (body.ended_at !== undefined) updates.ended_at = body.ended_at;
    if (body.display_mode === "auto" || body.display_mode === "approve_first") {
      updates.display_mode = body.display_mode;
    }

    if (Object.keys(updates).length === 0) {
      const { data, error } = await supabaseAdmin
        .from("prompt_game_sessions")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(rowToSession(data));
    }

    let { data, error } = await supabaseAdmin
      .from("prompt_game_sessions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error && updates.display_mode && /display_mode/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Display mode needs the live-media-moments SQL migration. Run supabase/live-media-moments.sql in Supabase.",
        },
        { status: 503 }
      );
    }
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(rowToSession(data));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
