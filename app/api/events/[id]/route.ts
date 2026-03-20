import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localEventsGetById,
  localEventsUpdate,
} from "@/lib/local-events-store";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

function rowToEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    venue: row.venue,
    address: row.address,
    prompt: row.prompt,
    heroImage: row.hero_image ?? "",
    agentThemeId: row.agent_theme_id ?? null,
    agentBrief: row.agent_brief ?? null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (USE_LOCAL_EVENTS) {
    const { id } = await params;
    const event = localEventsGetById(id);
    if (!event) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(rowToEvent(event));
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set USE_LOCAL_EVENTS=true in .env.local for local testing." },
      { status: 503 }
    );
  }
  const { id } = await params;
  try {
    const { data, error } = await supabaseAdmin.from("events").select("*").eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(rowToEvent(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (USE_LOCAL_EVENTS) {
    const { id } = await params;
    try {
      const body = await request.json();
      const updates: Record<string, unknown> = {};
      if (body.slug !== undefined) updates.slug = body.slug;
      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.date !== undefined) updates.date = body.date;
      if (body.time !== undefined) updates.time = body.time;
      if (body.venue !== undefined) updates.venue = body.venue;
      if (body.address !== undefined) updates.address = body.address;
      if (body.prompt !== undefined) updates.prompt = body.prompt;
      if (body.heroImage !== undefined) updates.hero_image = body.heroImage;
      if (body.agentThemeId !== undefined) updates.agent_theme_id = body.agentThemeId;
      if (body.agentBrief !== undefined) updates.agent_brief = body.agentBrief;
      const updated = localEventsUpdate(id, updates as Partial<import("@/lib/local-events-store").EventRow>);
      if (!updated) return NextResponse.json(null, { status: 404 });
      return NextResponse.json(rowToEvent(updated));
    } catch (err) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set USE_LOCAL_EVENTS=true in .env.local for local testing." },
      { status: 503 }
    );
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const row: Record<string, unknown> = {};
    if (body.slug !== undefined) row.slug = body.slug;
    if (body.title !== undefined) row.title = body.title;
    if (body.description !== undefined) row.description = body.description;
    if (body.date !== undefined) row.date = body.date;
    if (body.time !== undefined) row.time = body.time;
    if (body.venue !== undefined) row.venue = body.venue;
    if (body.address !== undefined) row.address = body.address;
    if (body.prompt !== undefined) row.prompt = body.prompt;
    if (body.heroImage !== undefined) row.hero_image = body.heroImage;
    if (body.agentThemeId !== undefined) row.agent_theme_id = body.agentThemeId;
    if (body.agentBrief !== undefined) row.agent_brief = body.agentBrief;

    const { data, error } = await supabaseAdmin.from("events").update(row).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToEvent(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
