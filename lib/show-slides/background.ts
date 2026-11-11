import type { Event } from "@/data/mockEvents";
import { localEventsGetAll, localEventsGetById } from "@/lib/local-events-store";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  EVENT_DETAIL_SELECT,
  listStoryboardVersionsForEvent,
  recoverStoryboardForEvent,
  rowToEvent,
  storyboardNeedsRecovery,
} from "@/lib/events-db";
import { getChapterByEventId, getGardenByIdOrSlug, listChapters, listGardens } from "@/lib/song-garden-v2/garden/store";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  resolveWorldConfig,
} from "@/lib/song-garden-v2/world-config";
import {
  accessibleBloomBackgrounds,
  GATHER_BLOOM_ID,
  GATHER_BLOOM_SLUG,
  GATHER_SHOW_ID,
  type ShowDeck,
  type ShowLoop,
  type StoryboardPlate,
} from "@/lib/show-slides/model";

/** Public read of the live Gather bloom. Used when this workspace has no database row for it. */
const GATHER_PUBLIC_EVENT_URL = `https://app.crowdsourcechoir.com/api/events?slug=${GATHER_BLOOM_SLUG}`;

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

async function fetchPublicGatherEvent(): Promise<Event | null> {
  try {
    const res = await fetch(GATHER_PUBLIC_EVENT_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Event | null;
    if (!data || typeof data !== "object" || !data.worldConfig) return null;
    return data;
  } catch {
    return null;
  }
}

function bloomMatches(row: { slug: string; title: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return row.slug.toLowerCase().includes(q) || row.title.toLowerCase().includes(q);
}

async function storedPlates(eventId: string, slug: string | null): Promise<StoryboardPlate[]> {
  if (!supabaseAdmin) return [];
  const versions = await listStoryboardVersionsForEvent({ eventId, slug });
  return versions.map((version) => ({
    videoUrl: version.videoUrl,
    sceneUrl: version.sceneUrl,
    frameIndex: version.frameIndex,
  }));
}

/**
 * Video plates come from the assigned bloom's storyboard, in the order the bloom shows them.
 * Stored generations that are not on the board stay available.
 * A garden named like the show (Gather) supplies its open chapter when no bloom is locked.
 */
export async function resolveShowBackground(show: ShowDeck): Promise<ShowBackground> {
  const rows = await listBloomRows();
  let bloomId = show.bloomId;
  if (show.id === GATHER_SHOW_ID && !bloomId) bloomId = GATHER_BLOOM_ID;
  if (!bloomId && show.match && show.id !== GATHER_SHOW_ID) {
    bloomId = rows.find((row) => bloomMatches(row, show.match ?? ""))?.id ?? null;
  }

  let garden: { id: string; title: string } | null = null;
  let gardenFrames: StoryboardPlate[] = [];
  let gardenPrimary = DEFAULT_PRIMARY_COLOR;
  let gardenAccent = DEFAULT_ACCENT_COLOR;

  async function takeGarden(idOrSlug: string) {
    const loaded = await getGardenByIdOrSlug(idOrSlug);
    if (!loaded) return;
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

  if (show.gardenId) {
    await takeGarden(show.gardenId);
  } else if (!bloomId && show.match) {
    const named = (await listGardens()).find((item) => bloomMatches(item, show.match ?? ""));
    if (named) await takeGarden(named.id);
  }

  let event = bloomId ? await loadEvent(bloomId) : null;
  if (!event && (bloomId === GATHER_BLOOM_ID || bloomId === GATHER_BLOOM_SLUG)) {
    const bySlug = rows.find((row) => row.slug === GATHER_BLOOM_SLUG || row.id === GATHER_BLOOM_ID);
    event = bySlug ? await loadEvent(bySlug.id) : null;
    if (!event) event = await fetchPublicGatherEvent();
  }
  if (event) {
    const world = resolveWorldConfig(event);
    if (!garden) {
      const chapter = await getChapterByEventId(String(event.id));
      if (chapter) await takeGarden(chapter.gardenId);
    }
    const stored = await storedPlates(String(event.id), event.slug);
    const loops = accessibleBloomBackgrounds(world.worldStoryboard, stored, gardenFrames);
    return {
      bloom: { id: String(event.id), slug: String(event.slug), title: event.title },
      garden,
      primaryColor: world.primaryColor || gardenPrimary,
      accentColor: world.accentColor || gardenAccent,
      loops,
      source: world.worldStoryboard.length ? "bloom" : loops.length ? (garden ? "garden" : "bloom") : "none",
    };
  }

  const gardenLoops = accessibleBloomBackgrounds(null, null, gardenFrames);
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
