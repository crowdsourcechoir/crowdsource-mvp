import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localEventsGetById,
  localEventsUpdate,
} from "@/lib/local-events-store";
import {
  persistDataUrlMedia,
  resolveHeroImageForStorage,
} from "@/lib/song-garden-v2/persist-generated-media";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

import type { SongGardenConfig } from "@/lib/songgarden/config";
import type { WorldConfig } from "@/lib/song-garden-v2/world-config";

/** Omit hero_image so PATCH responses stay small after bloated data-URI heroes. */
const EVENT_SELECT_LEAN =
  "id,slug,title,description,date,time,venue,address,prompt,hero_image_mode,landing_headline,landing_copy,cta_text,anthem_completion_message,allow_audio_video_prompt,agent_theme_id,agent_brief,song_garden_config,world_config";

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
    heroImageMode: row.hero_image_mode === "color" ? "color" : "bw",
    landingHeadline:
      (row.landing_headline as string) ??
      "We're crowdsourcing a song for this event. Want to help create it?",
    landingCopy: (row.landing_copy as string) ?? "",
    ctaText: (row.cta_text as string) ?? "Let's make an anthem",
    anthemCompletionMessage:
      (row.anthem_completion_message as string) ??
      "Thanks! Your answers will help shape the song we're making.",
    allowAudioVideoPrompt: (row.allow_audio_video_prompt as boolean) ?? true,
    agentThemeId: row.agent_theme_id ?? null,
    agentBrief: row.agent_brief ?? null,
    songGardenConfig: (row.song_garden_config as SongGardenConfig | null) ?? null,
    journeySteps:
      ((row.song_garden_config as SongGardenConfig | null)?.journeySteps as unknown[] | undefined) ??
      null,
    worldConfig: (row.world_config as WorldConfig | null) ?? null,
  };
}

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
      .select(EVENT_SELECT_LEAN)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const responseRow: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
      hero_image: typeof row.hero_image === "string" ? row.hero_image : "",
    };

    // Migrate any leftover data-URI hero in the background (does not block save).
    if (body.heroImage === undefined) {
      scheduleHeroMigration(id);
    }

    return NextResponse.json(rowToEvent(responseRow));
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
