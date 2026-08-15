import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { listStoryboardVersionsForEvent } from "@/lib/events-db";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/**
 * List every persisted Runway still/loop for this bloom (including superseded gens).
 * Generate used to replace worldConfig frames — the media files stay in storage.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventKey } = await context.params;
  const key = eventKey?.trim();
  if (!key) {
    return NextResponse.json({ error: "event id or slug required." }, { status: 400, ...NO_STORE });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ versions: [], prefixes: [] }, NO_STORE);
  }

  let eventId = key;
  let slug: string | null = null;

  const byId = await supabaseAdmin
    .from("events")
    .select("id,slug")
    .eq("id", key)
    .maybeSingle();
  if (byId.data) {
    eventId = byId.data.id;
    slug = byId.data.slug ?? null;
  } else {
    const bySlug = await supabaseAdmin
      .from("events")
      .select("id,slug")
      .eq("slug", key)
      .maybeSingle();
    if (bySlug.data) {
      eventId = bySlug.data.id;
      slug = bySlug.data.slug ?? null;
    } else {
      // Unsaved / draft generate path uses slug or "draft" as storage prefix.
      slug = key;
    }
  }

  const versions = await listStoryboardVersionsForEvent({ eventId, slug });
  return NextResponse.json(
    {
      eventId,
      slug,
      prefixes: [slug, eventId].filter(Boolean),
      versions,
    },
    NO_STORE
  );
}
