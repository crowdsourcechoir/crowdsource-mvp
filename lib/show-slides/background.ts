import type { Event } from "@/data/mockEvents";
import { localEventsGetAll, localEventsGetById } from "@/lib/local-events-store";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  EVENT_DETAIL_SELECT,
  recoverStoryboardForEvent,
  rowToEvent,
  storyboardNeedsRecovery,
} from "@/lib/events-db";
import { getGardenByIdOrSlug, listChapters } from "@/lib/song-garden-v2/garden/store";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  resolveWorldConfig,
  type WorldConfig,
  type WorldStoryboardFrame,
} from "@/lib/song-garden-v2/world-config";
import {
  loopsFromStoryboard,
  type ShowDeck,
  type ShowLoop,
} from "@/lib/show-slides/model";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

export type ShowBackground = {
  bloom: { id: string; slug: string; title: string } | null;
  garden: { id: string; title: string } | null;
  primaryColor: string;
  accentColor: string;
  loops: ShowLoop[];
  source: "bloom" | "garden" | "none";
};

const EMPTY_BACKGROUND: ShowBackground = {
  bloom: null,
  garden: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  loops: [],
  source: "none",
};

type BloomRow = { id: string; slug: string; title: string };

async function listBloomRows(): Promise<BloomRow[]> {
  if (USE_LOCAL_EVENTS) {
    return localEventsGetAll().map((row) => ({
      id: String(row.id),
      slug: String(row.slug ?? ""),
      title: String(row.title ?? "Bloom"),
    }));
  }
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from("events").select("id,slug,title");
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? "Bloom"),
  }));
}

async function loadEvent(id: string): Promise<Event | null> {
  if (USE_LOCAL_EVENTS) {
    const row = localEventsGetById(id);
    return row ? (rowToEvent(row as unknown as Record<string, unknown>) as Event) : null;
  }
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.from("events").select(EVENT_DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const event = rowToEvent(data as unknown as Record<string, unknown>) as Event;
  if (storyboardNeedsRecovery(event.worldConfig)) {
    const recovered = await recoverStoryboardForEvent({
      eventId: String(event.id),
      slug: String(event.slug),
      worldConfig: event.worldConfig,
    });
    if (recovered.recovered && recovered.worldConfig) {
      await supabaseAdmin.from("events").update({ world_config: recovered.worldConfig }).eq("id", event.id);
      event.worldConfig = recovered.worldConfig;
    }
  }
  return event;
}

function bloomMatches(row: BloomRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return row.slug.toLowerCase().includes(q) || row.title.toLowerCase().includes(q);
}

async function storyboardFor(event: Event): Promise<{ world: WorldConfig; loops: ShowLoop[] }> {
  const world = resolveWorldConfig(event);
  return { world, loops: loopsFromStoryboard(world.worldStoryboard) };
}

/**
 * Video loops come from the assigned bloom's storyboard.
 * A garden with no bloom uses its open chapter, then the garden's own bloom storyboard.
 * Gather, with nothing locked yet, binds the bloom whose name contains "gather".
 */
export async function resolveShowBackground(show: ShowDeck): Promise<ShowBackground> {
  const rows = await listBloomRows();
  let bloomId = show.bloomId;
  if (!bloomId && show.match) {
    bloomId = rows.find((row) => bloomMatches(row, show.match ?? ""))?.id ?? null;
  }

  let garden: { id: string; title: string } | null = null;
  let gardenFrames: WorldStoryboardFrame[] = [];
  let gardenPrimary = DEFAULT_PRIMARY_COLOR;
  let gardenAccent = DEFAULT_ACCENT_COLOR;

  if (show.gardenId) {
    const loaded = await getGardenByIdOrSlug(show.gardenId);
    if (loaded) {
      garden = { id: loaded.id, title: loaded.title };
      gardenFrames = loaded.brandKit.bloomStoryboard ?? [];
      gardenPrimary = loaded.brandKit.primaryColor || gardenPrimary;
      gardenAccent = loaded.brandKit.accentColor || gardenAccent;
      if (!bloomId) {
        const chapters = await listChapters(loaded.id);
        const chapter = chapters.find((item) => item.status === "open") ?? chapters[chapters.length - 1] ?? null;
        bloomId = chapter?.eventId ?? null;
      }
    }
  }

  const event = bloomId ? await loadEvent(bloomId) : null;
  if (event) {
    const { world, loops } = await storyboardFor(event);
    const bloomLoops = loops.length ? loops : loopsFromStoryboard(gardenFrames);
    return {
      bloom: { id: String(event.id), slug: String(event.slug), title: event.title },
      garden,
      primaryColor: world.primaryColor || gardenPrimary,
      accentColor: world.accentColor || gardenAccent,
      loops: bloomLoops,
      source: loops.length ? "bloom" : bloomLoops.length ? "garden" : "none",
    };
  }

  const gardenLoops = loopsFromStoryboard(gardenFrames);
  if (garden && gardenLoops.length) {
    return {
      bloom: null,
      garden,
      primaryColor: gardenPrimary,
      accentColor: gardenAccent,
      loops: gardenLoops,
      source: "garden",
    };
  }

  return {
    ...EMPTY_BACKGROUND,
    garden,
    primaryColor: garden ? gardenPrimary : EMPTY_BACKGROUND.primaryColor,
    accentColor: garden ? gardenAccent : EMPTY_BACKGROUND.accentColor,
  };
}
