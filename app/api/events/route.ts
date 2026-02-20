import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  try {
    if (slug) {
      const { data, error } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) {
        if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(rowToEvent(data));
    }

    const { data, error } = await supabaseAdmin.from("events").select("*").order("date", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map(rowToEvent));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const row = eventToRow(body);
    const { data, error } = await supabaseAdmin.from("events").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(rowToEvent(data));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function eventToRow(e: Record<string, unknown>) {
  return {
    slug: e.slug ?? "",
    title: e.title ?? "",
    description: e.description ?? "",
    date: e.date ?? "",
    time: e.time ?? "",
    venue: e.venue ?? "",
    address: e.address ?? "",
    prompt: e.prompt ?? "",
    hero_image: e.heroImage ?? "",
  };
}

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
