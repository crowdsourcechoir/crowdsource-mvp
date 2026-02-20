import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
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
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
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

    const { data, error } = await supabaseAdmin.from("events").update(row).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToEvent(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
