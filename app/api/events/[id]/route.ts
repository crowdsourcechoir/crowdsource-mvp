import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localEventsGetById,
  localEventsUpdate,
} from "@/lib/local-events-store";
import { deleteEventById } from "@/lib/event-delete";
import {
  persistDataUrlMedia,
  resolveHeroImageForStorage,
} from "@/lib/song-garden-v2/persist-generated-media";
import {
  EVENT_DETAIL_SELECT,
  attachHostedHeroes,
  recoverStoryboardForEvent,
  rowToEvent,
  storyboardNeedsRecovery,
} from "@/lib/events-db";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

import type { SongGardenConfig } from "@/lib/songgarden/config";

function scheduleHeroMigration(id: string, knownHero?: string): void {
  const run = async () => {
    try {
      let hero = knownHero;
      if (hero == null && supabaseAdmin) {
        const { data } = await supabaseAdmin.from("events").select("hero_image").eq("id", id).maybeSingle();
        hero = typeof data?.hero_image === "string" ? data.hero_image : undefined;
      }
      if (typeof hero !== "string" || !hero.startsWith("data:image/")) return;
      const url = await persistDataUrlMedia(hero, `${id}-hero`);
      if (USE_LOCAL_EVENTS) {
        localEventsUpdate(id, { hero_image: url });
        return;
      }
      if (!supabaseAdmin) return;
      await supabaseAdmin.from("events").update({ hero_image: url }).eq("id", id);
    } catch (err) {
      console.error("[events] hero migration failed:", err);
    }
  };

  try {
    waitUntil(run());
  } catch {
    void run();
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (USE_LOCAL_EVENTS) {
    const { id } = await params;
    const event = localEventsGetById(id);
    if (!event) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(rowToEvent(event as unknown as Record<string, unknown>));
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set USE_LOCAL_EVENTS=true in .env.local for local testing." },
      { status: 503 }
    );
  }
  const { id } = await params;
  try {
    const { data, error } = await supabaseAdmin.from("events").select(EVENT_DETAIL_SELECT).eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json(null, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const event = rowToEvent(data as unknown as Record<string, unknown>);
    await attachHostedHeroes([event]);
    if (!event.heroImage) scheduleHeroMigration(id);
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
          .eq("id", id);
        event.worldConfig = recovered.worldConfig;
      }
    }
    return NextResponse.json(event);
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
      if (body.heroImage !== undefined) {
        updates.hero_image = await resolveHeroImageForStorage(body.heroImage, id);
      }
      if (body.heroImageMode !== undefined) updates.hero_image_mode = body.heroImageMode;
      if (body.landingHeadline !== undefined) updates.landing_headline = body.landingHeadline;
      if (body.landingCopy !== undefined) updates.landing_copy = body.landingCopy;
      if (body.ctaText !== undefined) updates.cta_text = body.ctaText;
      if (body.anthemCompletionMessage !== undefined) {
        updates.anthem_completion_message = body.anthemCompletionMessage;
      }
      if (body.allowAudioVideoPrompt !== undefined) {
        updates.allow_audio_video_prompt = body.allowAudioVideoPrompt;
      }
      if (body.agentThemeId !== undefined) updates.agent_theme_id = body.agentThemeId;
      if (body.agentBrief !== undefined) updates.agent_brief = body.agentBrief;
      if (body.songGardenConfig !== undefined || body.journeySteps !== undefined) {
        const base =
          (body.songGardenConfig as SongGardenConfig | null | undefined) ??
          ({} as SongGardenConfig);
        updates.song_garden_config = {
          ...base,
          ...(Array.isArray(body.journeySteps) ? { journeySteps: body.journeySteps } : {}),
        };
      }
      if (body.worldConfig !== undefined) updates.world_config = body.worldConfig;
      const updated = localEventsUpdate(id, updates as Partial<import("@/lib/local-events-store").EventRow>);
      if (!updated) return NextResponse.json(null, { status: 404 });
      if (body.heroImage === undefined) {
        const existing = typeof updated.hero_image === "string" ? updated.hero_image : undefined;
        scheduleHeroMigration(id, existing);
      }
      return NextResponse.json(rowToEvent(updated as unknown as Record<string, unknown>));
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
    if (body.heroImage !== undefined) {
      row.hero_image = await resolveHeroImageForStorage(body.heroImage, id);
    }
    if (body.heroImageMode !== undefined) row.hero_image_mode = body.heroImageMode;
    if (body.landingHeadline !== undefined) row.landing_headline = body.landingHeadline;
    if (body.landingCopy !== undefined) row.landing_copy = body.landingCopy;
    if (body.ctaText !== undefined) row.cta_text = body.ctaText;
    if (body.anthemCompletionMessage !== undefined) {
      row.anthem_completion_message = body.anthemCompletionMessage;
    }
    if (body.allowAudioVideoPrompt !== undefined) {
      row.allow_audio_video_prompt = body.allowAudioVideoPrompt;
    }
    if (body.agentThemeId !== undefined) row.agent_theme_id = body.agentThemeId;
    if (body.agentBrief !== undefined) row.agent_brief = body.agentBrief;
    if (body.songGardenConfig !== undefined || body.journeySteps !== undefined) {
      const base =
        (body.songGardenConfig as SongGardenConfig | null | undefined) ??
        ({} as SongGardenConfig);
      row.song_garden_config = {
        ...base,
        ...(Array.isArray(body.journeySteps) ? { journeySteps: body.journeySteps } : {}),
      };
    }
    if (body.worldConfig !== undefined) row.world_config = body.worldConfig;

    // Lean select — never pull a multi‑MB data-URI hero back into the response.
    const { data, error } = await supabaseAdmin
      .from("events")
      .update(row)
      .eq("id", id)
      .select(EVENT_DETAIL_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const event = rowToEvent({
      ...(data as Record<string, unknown>),
      ...(typeof row.hero_image === "string" ? { hero_image: row.hero_image } : {}),
    });
    if (!event.heroImage) {
      await attachHostedHeroes([event]);
    }

    // Migrate any leftover data-URI hero in the background (does not block save).
    if (body.heroImage === undefined && !event.heroImage) {
      scheduleHeroMigration(id);
    }

    return NextResponse.json(event);
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Event id is required." }, { status: 400 });
  }
  try {
    const deleted = await deleteEventById(id);
    if (!deleted) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
