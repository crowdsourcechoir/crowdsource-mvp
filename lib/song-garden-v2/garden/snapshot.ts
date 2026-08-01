import {
  resolveStoryboardFrame,
  type WorldConfig,
} from "@/lib/song-garden-v2/world-config";
import type {
  BrandKit,
  Garden,
  GardenChapter,
  GardenSnapshot,
  ParticipantMark,
} from "./types";

export function buildGardenSnapshot(args: {
  garden: Garden;
  chapter?: GardenChapter | null;
  eventSlug?: string | null;
  myMarks?: ParticipantMark[];
}): GardenSnapshot {
  const { garden, chapter = null, eventSlug = null, myMarks = [] } = args;
  const brand = garden.brandKit;
  const bloomWorld = {
    title: brand.title,
    heroArtworkUrl: brand.heroArtworkUrl,
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    animationPreset: brand.animationPreset,
    ambientSoundtrackUrl: brand.ambientSoundtrackUrl,
    aiArtworkPrompt: null,
    worldSceneStages: [],
    worldStoryboard: brand.bloomStoryboard,
    presenceSimulationEnabled: true,
  } satisfies WorldConfig;

  const resolved = resolveStoryboardFrame(bloomWorld, garden.worldState.energy);

  return {
    garden: {
      id: garden.id,
      slug: garden.slug,
      title: garden.title,
      kind: garden.kind,
      status: garden.status,
      worldVersion: garden.worldVersion,
    },
    brand,
    state: garden.worldState,
    activeChapter: chapter
      ? {
          id: chapter.id,
          index: chapter.index,
          label: chapter.label,
          eventId: chapter.eventId,
          eventSlug: eventSlug ?? "",
          status: chapter.status,
        }
      : null,
    myMarks,
    bloom: resolved
      ? {
          index: resolved.index,
          total: resolved.total,
          energy: resolved.energy,
          frame: resolved.frame,
        }
      : null,
  };
}

/** Merge brand bloom storyboard into a WorldConfig for WorldStage when garden-linked. */
export function worldConfigFromBrand(brand: BrandKit, fallback: WorldConfig): WorldConfig {
  return {
    ...fallback,
    title: brand.title || fallback.title,
    logoUrl: brand.logoUrl ?? fallback.logoUrl,
    primaryColor: brand.primaryColor || fallback.primaryColor,
    accentColor: brand.accentColor || fallback.accentColor,
    heroArtworkUrl: brand.heroArtworkUrl ?? fallback.heroArtworkUrl,
    animationPreset: brand.animationPreset || fallback.animationPreset,
    ambientSoundtrackUrl: brand.ambientSoundtrackUrl ?? fallback.ambientSoundtrackUrl,
    // Prefer garden bloom storyboard for shared energy; keep event storyboard if garden has none.
    worldStoryboard: brand.bloomStoryboard.length
      ? brand.bloomStoryboard
      : fallback.worldStoryboard,
  };
}
