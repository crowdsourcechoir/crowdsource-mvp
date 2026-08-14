import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  EVENT_DETAIL_SELECT,
  listStoryboardOrphans,
  recoverStoryboardForEvent,
  rowToEvent,
} from "@/lib/events-db";
import { normalizeWorldConfigInput } from "@/lib/song-garden-v2/world-config";
import type { SongGardenConfig } from "@/lib/songgarden/config";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type RestoreBody = {
  prefix?: string;
  eventId?: string;
  title?: string;
  slug?: string;
  description?: string;
  date?: string;
  time?: string;
  venue?: string;
  address?: string;
  prompt?: string;
  landingHeadline?: string;
  landingCopy?: string;
  ctaText?: string;
  anthemCompletionMessage?: string;
  agentThemeId?: string | null;
  agentBrief?: unknown;
  songGardenConfig?: SongGardenConfig | null;
  journeySteps?: unknown;
  aiArtworkPrompt?: string;
};

function songGardenFromBody(body: RestoreBody): SongGardenConfig | null {
  const garden = body.songGardenConfig ?? null;
  const journeySteps = body.journeySteps;
  if (!garden && !Array.isArray(journeySteps)) return null;
  return {
    ...(garden ?? { soundTransitionMessage: "", steps: [] }),
    ...(Array.isArray(journeySteps) ? { journeySteps } : {}),
  };
}

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
 * so the generated world isn't lost. Accepts optional form-draft fields so
 * journey prompts survive a create that timed out after Runway finished.
 */
export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as RestoreBody;
  const prefix = body.prefix?.trim();
  if (!prefix) return NextResponse.json({ error: "prefix is required." }, { status: 400 });

  const draftGarden = songGardenFromBody(body);

  let eventId = body.eventId?.trim() || "";
  if (!eventId) {
    const bySlug = await supabaseAdmin.from("events").select("id").eq("slug", prefix).maybeSingle();
    eventId = bySlug.data?.id ?? "";
  }
  if (!eventId && body.slug?.trim()) {
    const byDraftSlug = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", body.slug.trim())
      .maybeSingle();
    eventId = byDraftSlug.data?.id ?? "";
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
    const draftVibe = body.aiArtworkPrompt?.trim() || "";
    const world = normalizeWorldConfigInput({
      ...(recovered.worldConfig ?? { worldStoryboard: [] }),
      ...(draftVibe ? { aiArtworkPrompt: draftVibe } : {}),
    });
    const insertSlug = (body.slug?.trim() || prefix).slice(0, 80);
    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        slug: insertSlug,
        title: body.title?.trim() || prefix.replace(/[-_]+/g, " "),
        description: body.description ?? "",
        date: body.date?.trim() || today,
        time: body.time?.trim() || "19:00",
        venue: body.venue ?? "",
        address: body.address ?? "",
        prompt: body.prompt ?? "",
        landing_headline: body.landingHeadline,
        landing_copy: body.landingCopy,
        cta_text: body.ctaText,
        anthem_completion_message: body.anthemCompletionMessage,
        agent_theme_id: body.agentThemeId ?? null,
        agent_brief: body.agentBrief ?? null,
        song_garden_config: draftGarden,
        world_config: world,
      })
      .select(EVENT_DETAIL_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      created: true,
      event: rowToEvent(data as Record<string, unknown>),
      recovered: recovered.recovered,
      promptsRestored: Boolean(draftGarden || draftVibe),
    });
  }

  const { data: row, error } = await supabaseAdmin
    .from("events")
    .select("id,slug,world_config,song_garden_config,agent_brief")
    .eq("id", eventId)
    .single();
  if (error || !row) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const recovered = await recoverStoryboardForEvent({
    eventId: row.id,
    slug: row.slug,
    worldConfig: row.world_config,
  });

  const updates: Record<string, unknown> = {};
  let nextWorld = recovered.recovered && recovered.worldConfig
    ? recovered.worldConfig
    : (row.world_config as ReturnType<typeof normalizeWorldConfigInput>);

  const existingVibe =
    nextWorld && typeof nextWorld === "object"
      ? String((nextWorld as { aiArtworkPrompt?: string | null }).aiArtworkPrompt ?? "").trim()
      : "";
  const draftVibe = body.aiArtworkPrompt?.trim() || "";
  if (draftVibe && !existingVibe) {
    nextWorld = normalizeWorldConfigInput({
      ...(nextWorld && typeof nextWorld === "object" ? nextWorld : {}),
      aiArtworkPrompt: draftVibe,
    });
  }
  if (nextWorld && (recovered.recovered || (draftVibe && !existingVibe))) {
    updates.world_config = nextWorld;
  }

  // Fill empty prompt fields from the browser draft when the bloom is a shell.
  const existingGarden = row.song_garden_config as SongGardenConfig | null;
  const existingSteps = existingGarden?.journeySteps;
  const hasExistingPrompts = Array.isArray(existingSteps) && existingSteps.length > 0;
  if (draftGarden && !hasExistingPrompts) {
    updates.song_garden_config = draftGarden;
    if (body.agentBrief != null && row.agent_brief == null) {
      updates.agent_brief = body.agentBrief;
    }
    if (body.title?.trim()) updates.title = body.title.trim();
    if (body.description != null) updates.description = body.description;
    if (body.date?.trim()) updates.date = body.date.trim();
    if (body.time?.trim()) updates.time = body.time.trim();
    if (body.venue != null) updates.venue = body.venue;
    if (body.address != null) updates.address = body.address;
    if (body.prompt != null) updates.prompt = body.prompt;
    if (body.landingHeadline != null) updates.landing_headline = body.landingHeadline;
    if (body.landingCopy != null) updates.landing_copy = body.landingCopy;
    if (body.ctaText != null) updates.cta_text = body.ctaText;
    if (body.anthemCompletionMessage != null) {
      updates.anthem_completion_message = body.anthemCompletionMessage;
    }
    if (body.agentThemeId !== undefined) updates.agent_theme_id = body.agentThemeId;
  }

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("events").update(updates).eq("id", row.id);
  }

  return NextResponse.json({
    created: false,
    eventId: row.id,
    recovered: recovered.recovered,
    frameCount:
      (nextWorld && typeof nextWorld === "object"
        ? (nextWorld as { worldStoryboard?: unknown[] }).worldStoryboard?.length
        : 0) ?? 0,
    promptsRestored: Boolean((draftGarden && !hasExistingPrompts) || (draftVibe && !existingVibe)),
  });
}
