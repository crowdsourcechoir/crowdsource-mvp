import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { canonicalEventSlug } from "@/lib/event-slug-aliases";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import {
  localEventsGetAll,
  localEventsGetBySlug,
  localEventsCreate,
} from "@/lib/local-events-store";
import {
  EVENT_DETAIL_SELECT,
  EVENT_LIST_SELECT,
  attachHostedHeroes,
  recoverStoryboardForEvent,
  rowToEvent,
  storyboardNeedsRecovery,
} from "@/lib/events-db";
import { leanWorldConfigKeepingVibe, type WorldConfig } from "@/lib/song-garden-v2/world-config";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

export async function GET(request: Request) {
  if (USE_LOCAL_EVENTS) {
    const { searchParams } = new URL(request.url);
    const rawSlug = searchParams.get("slug");
    const slug = rawSlug ? canonicalEventSlug(rawSlug) : null;
    if (slug) {
      const event = localEventsGetBySlug(slug);
      if (!event) return NextResponse.json(null, { status: 404 });
      return NextResponse.json(rowToEvent(event as unknown as Record<string, unknown>));
    }
    const data = localEventsGetAll();
    return NextResponse.json(data.map((row) => rowToEvent(row as unknown as Record<string, unknown>)));
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set USE_LOCAL_EVENTS=true in .env.local for local testing." },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const rawSlug = searchParams.get("slug");
  const slug = rawSlug ? canonicalEventSlug(rawSlug) : null;

  try {
    if (slug) {
      const { data, error } = await supabaseAdmin
        .from("events")
        .select(EVENT_DETAIL_SELECT)
        .eq("slug", slug)
        .single();
      if (error) {
        if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const event = rowToEvent(data as unknown as Record<string, unknown>);
      await attachHostedHeroes([event]);
      if (storyboardNeedsRecovery(event.worldConfig)) {
        const recovered = await recoverStoryboardForEvent({
          eventId: String(event.id),
          slug: String(event.slug),
          worldConfig: event.worldConfig,
        });
        if (recovered.recovered && recovered.worldConfig) {
          await supabaseAdmin
            .from("events")
            .update({ world_config: recovered.worldConfig })
            .eq("id", event.id);
          event.worldConfig = recovered.worldConfig;
        }
      }
      return NextResponse.json(event);
    }

    const { data, error } = await supabaseAdmin
      .from("events")
      .select(EVENT_LIST_SELECT)
      .order("date", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const list = (data ?? []).map((row) => {
      const e = rowToEvent(row as Record<string, unknown>);
      return { ...e, agentBrief: null, worldConfig: null };
    });
    try {
      await attachHostedHeroes(list);
    } catch (err) {
      console.error("[events] attach hosted heroes failed:", err);
    }
    return NextResponse.json(list, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (USE_LOCAL_EVENTS) {
    try {
      const body = await request.json();
      const row = eventToRow(body);
      const created = localEventsCreate({
        slug: row.slug as string,
        title: row.title as string,
        description: row.description as string,
        date: row.date as string,
        time: row.time as string,
        venue: row.venue as string,
        address: row.address as string,
        prompt: row.prompt as string,
        hero_image: row.hero_image as string,
        hero_image_mode: (row.hero_image_mode as "bw" | "color") ?? "bw",
        landing_headline:
          (row.landing_headline as string) ??
          "We're crowdsourcing a song for this event. Want to help create it?",
        landing_copy: (row.landing_copy as string) ?? "",
        cta_text: (row.cta_text as string) ?? "Let's make an anthem",
        anthem_completion_message:
          (row.anthem_completion_message as string) ??
          "Thanks! Your answers will help shape the song we're making.",
        allow_audio_video_prompt: (row.allow_audio_video_prompt as boolean) ?? true,
        agent_theme_id: row.agent_theme_id as string | null,
        agent_brief: row.agent_brief,
        song_garden_config: row.song_garden_config ?? null,
        world_config: row.world_config ?? null,
      });
      return NextResponse.json(rowToEvent(created as unknown as Record<string, unknown>));
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
  try {
    const body = await request.json();
    const row = eventToRow(body);
    const tempId =
      typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : `new_${Date.now().toString(36)}`;
    if (typeof row.hero_image === "string" && row.hero_image.startsWith("data:image/")) {
      const { resolveHeroImageForStorage } = await import(
        "@/lib/song-garden-v2/persist-generated-media"
      );
      const hosted = await resolveHeroImageForStorage(row.hero_image, tempId);
      row.hero_image = hosted ?? "";
    }

    // Phase 1: persist journey + vibe without heavy storyboard frames so a
    // world/timeout failure cannot wipe prompts Joel already wrote.
    const worldConfig = (row.world_config as WorldConfig | null) ?? null;
    const leanWorld = leanWorldConfigKeepingVibe(worldConfig);
    const leanRow = { ...row, world_config: leanWorld };
    const { data, error } = await supabaseAdmin
      .from("events")
      .insert(leanRow)
      .select(EVENT_DETAIL_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const created = rowToEvent({
      ...(data as Record<string, unknown>),
      ...(typeof row.hero_image === "string" ? { hero_image: row.hero_image } : {}),
    });
    const hasHeavyWorld = Boolean(worldConfig?.worldStoryboard?.length);
    if (worldConfig && hasHeavyWorld) {
      const { data: withWorld, error: worldError } = await supabaseAdmin
        .from("events")
        .update({ world_config: worldConfig })
        .eq("id", created.id)
        .select(EVENT_DETAIL_SELECT)
        .single();
      if (!worldError && withWorld) {
        return NextResponse.json(
          rowToEvent({
            ...(withWorld as Record<string, unknown>),
            ...(typeof row.hero_image === "string" ? { hero_image: row.hero_image } : {}),
          })
        );
      }
      // Vibe (+ lean world) already saved — return that even if frames did not attach.
      return NextResponse.json({
        ...created,
        _worldAttachError:
          worldError?.message ||
          "Bloom saved with vibe/prompts, but storyboard frames did not attach. Use Restore bloom if stills are in storage.",
      });
    }
    return NextResponse.json(created);
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
    hero_image_mode: (e as { heroImageMode?: "bw" | "color" }).heroImageMode ?? "bw",
    landing_headline:
      (e as { landingHeadline?: string }).landingHeadline ??
      "We're crowdsourcing a song for this event. Want to help create it?",
    landing_copy: (e as { landingCopy?: string }).landingCopy ?? "",
    cta_text: (e as { ctaText?: string }).ctaText ?? "Let's make an anthem",
    anthem_completion_message:
      (e as { anthemCompletionMessage?: string }).anthemCompletionMessage ??
      "Thanks! Your answers will help shape the song we're making.",
    allow_audio_video_prompt: (e as { allowAudioVideoPrompt?: boolean }).allowAudioVideoPrompt ?? true,
    agent_theme_id: (e as { agentThemeId?: string | null }).agentThemeId ?? null,
    agent_brief: (e as { agentBrief?: unknown }).agentBrief ?? null,
    song_garden_config: (() => {
      const garden = (e as { songGardenConfig?: SongGardenConfig | null }).songGardenConfig ?? null;
      const journeySteps = (e as { journeySteps?: unknown }).journeySteps;
      if (!garden && !journeySteps) return null;
      return {
        ...(garden ?? { soundTransitionMessage: "", steps: [] }),
        ...(Array.isArray(journeySteps) ? { journeySteps } : {}),
      };
    })(),
    world_config: (e as { worldConfig?: unknown }).worldConfig ?? null,
  };
}
