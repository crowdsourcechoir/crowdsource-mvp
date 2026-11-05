import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { rowToSession } from "@/lib/live-prompt-game/rows";

function randomSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
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
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const requestedName = typeof body?.name === "string" ? body.name.trim() : undefined;
    const requestedLinkedEventId =
      typeof body?.linked_event_id === "string" ? body.linked_event_id : null;

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
    const row: Record<string, unknown> = {
      slug,
      name: requestedName || "Live Prompt Game",
      state: "WAITING",
      linked_event_id: requestedLinkedEventId || null,
      display_mode: "auto",
    };
    let { data, error } = await supabaseAdmin.from("prompt_game_sessions").insert(row).select().single();
    // Migration may not be applied yet — retry without display_mode.
    if (error && /display_mode/i.test(error.message)) {
      delete row.display_mode;
      const retry = await supabaseAdmin.from("prompt_game_sessions").insert(row).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToSession(data));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
