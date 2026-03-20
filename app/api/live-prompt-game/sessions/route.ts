import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function randomSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

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

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  try {
    if (slug) {
      const { data, error } = await supabaseAdmin
        .from("prompt_game_sessions")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) {
        if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(rowToSession(data));
    }

    const { data, error } = await supabaseAdmin
      .from("prompt_game_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToSession));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const requestedName = typeof body?.name === "string" ? body.name.trim() : undefined;
    const requestedLinkedEventId = typeof body?.linked_event_id === "string" ? body.linked_event_id : null;

    let slug = randomSlug();
    for (let i = 0; i < 10; i++) {
      const { data: existing } = await supabaseAdmin
        .from("prompt_game_sessions")
        .select("id")
        .eq("slug", slug)
        .single();
      if (!existing) break;
      slug = randomSlug();
    }
    const row = {
      slug,
      // Mode label (drives UI). Default keeps old behavior for existing sessions.
      name: requestedName || "Live Prompt Game",
      state: "WAITING",
      linked_event_id: requestedLinkedEventId || null,
    };
    const { data, error } = await supabaseAdmin
      .from("prompt_game_sessions")
      .insert(row)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToSession(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
