import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { EVENT_LIST_SELECT, listStoryboardOrphans, recoverStoryboardForEvent } from "@/lib/events-db";
import { normalizeWorldConfigInput } from "@/lib/song-garden-v2/world-config";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/**
 * Find Runway storyboard files in storage that aren't attached to any event yet
 * (create timed out after generate, or slug/id mismatch).
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ orphans: [] }, NO_STORE);
  }
  const { data } = await supabaseAdmin.from("events").select("id,slug");
  const known = (data ?? []).flatMap((row: { id?: string; slug?: string }) => [
    row.id ?? "",
    row.slug ?? "",
  ]);
  const orphans = await listStoryboardOrphans(known);
  return NextResponse.json({ orphans }, NO_STORE);
}

/**
 * Attach orphaned storyboard files to an existing event, or create a bloom
 * so the generated world isn't lost.
 */
export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    prefix?: string;
    eventId?: string;
    title?: string;
  };
  const prefix = body.prefix?.trim();
  if (!prefix) return NextResponse.json({ error: "prefix is required." }, { status: 400 });

  let eventId = body.eventId?.trim() || "";
  if (!eventId) {
    const bySlug = await supabaseAdmin.from("events").select("id").eq("slug", prefix).maybeSingle();
    eventId = bySlug.data?.id ?? "";
  }
  if (!eventId) {
    const byId = await supabaseAdmin.from("events").select("id").eq("id", prefix).maybeSingle();
    eventId = byId.data?.id ?? "";
  }

  if (!eventId) {
    const today = new Date().toISOString().slice(0, 10);
    const recovered = await recoverStoryboardForEvent({
      eventId: prefix,
      slug: prefix,
      worldConfig: null,
    });
    const world = recovered.worldConfig ?? normalizeWorldConfigInput({ worldStoryboard: [] });
    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        slug: prefix.slice(0, 80),
        title: body.title?.trim() || prefix.replace(/[-_]+/g, " "),
        description: "",
        date: today,
        time: "19:00",
        venue: "",
        address: "",
        prompt: "",
        world_config: world,
      })
      .select(EVENT_LIST_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ created: true, event: data, recovered: recovered.recovered });
  }

  const { data: row, error } = await supabaseAdmin
    .from("events")
    .select("id,slug,world_config")
    .eq("id", eventId)
    .single();
  if (error || !row) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const recovered = await recoverStoryboardForEvent({
    eventId: row.id,
    slug: row.slug,
    worldConfig: row.world_config,
  });
  if (recovered.recovered && recovered.worldConfig) {
    await supabaseAdmin.from("events").update({ world_config: recovered.worldConfig }).eq("id", row.id);
  }
  return NextResponse.json({
    created: false,
    eventId: row.id,
    recovered: recovered.recovered,
    frameCount: recovered.worldConfig?.worldStoryboard?.length ?? 0,
  });
}
