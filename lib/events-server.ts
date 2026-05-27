import type { Event } from "@/data/mockEvents";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import { localEventsGetBySlug } from "@/lib/local-events-store";
import { supabaseAdmin } from "@/lib/supabase-server";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

function rowToEvent(row: Record<string, unknown>): Event {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    date: String(row.date ?? ""),
    time: String(row.time ?? ""),
    venue: String(row.venue ?? ""),
    address: String(row.address ?? ""),
    prompt: String(row.prompt ?? ""),
    heroImage: String(row.hero_image ?? ""),
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
    agentThemeId: (row.agent_theme_id as string | null) ?? null,
    agentBrief: (row.agent_brief as Event["agentBrief"]) ?? null,
    songGardenConfig: (row.song_garden_config as SongGardenConfig | null) ?? null,
  };
}

/** Server-side event lookup for metadata and OG image routes. */
export async function getEventBySlugServer(slug: string): Promise<Event | null> {
  if (!slug.trim()) return null;

  if (USE_LOCAL_EVENTS) {
    const row = localEventsGetBySlug(slug);
    return row ? rowToEvent(row as unknown as Record<string, unknown>) : null;
  }

  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return rowToEvent(data as Record<string, unknown>);
}
