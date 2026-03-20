import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function rowToSession(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name ?? "Live Prompt Game",
    state: row.state ?? "WAITING",
    current_round_id: row.current_round_id ?? null,
    linked_event_id: row.linked_event_id ?? null,
    created_at: row.created_at,
    ended_at: row.ended_at ?? null,
  };
}

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
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id } = await context.params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.state !== undefined) updates.state = body.state;
    if (body.current_round_id !== undefined) updates.current_round_id = body.current_round_id;
    if (body.ended_at !== undefined) updates.ended_at = body.ended_at;

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

    const { data, error } = await supabaseAdmin
      .from("prompt_game_sessions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(rowToSession(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
