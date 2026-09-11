import {
  resolveStoryboardFrame,
  type WorldConfig,
} from "@/lib/song-garden-v2/world-config";
import { resolveBrandOverlays } from "@/lib/song-garden-v2/brand-overlays";
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
  asOf?: string | null;
  window?: GardenSnapshot["window"];
}): GardenSnapshot {
  const {
    garden,
    chapter = null,
    eventSlug = null,
    myMarks = [],
    asOf = null,
    window: windowOverride,
  } = args;
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
  const window =
    windowOverride ??
    resolveContributionWindow({
      gardenStatus: garden.status,
      activeChapter: chapter,
    });

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
    window,
    asOf,
    zones: (garden.brandKit.zones ?? []).map((z) => ({
      ...z,
      runtime: garden.worldState.zones?.[z.key] ?? null,
      sponsor:
        (garden.brandKit.sponsors ?? []).find((s) => s.key === z.sponsorKey) ?? null,
    })),
  };
}

export function resolveContributionWindow(args: {
  gardenStatus: Garden["status"];
  activeChapter?: GardenChapter | null;
}): GardenSnapshot["window"] {
  if (args.gardenStatus === "archived" || args.gardenStatus === "draft") {
    return {
      mode: "closed",
      canContribute: false,
      message:
        args.gardenStatus === "draft"
          ? "This garden is still being prepared."
          : "This garden is archived.",
    };
  }
  if (args.activeChapter?.status === "open") {
    return {
      mode: "chapter",
      canContribute: true,
      message: `${args.activeChapter.label || "This show"} is open — your contributions grow the garden.`,
    };
  }
  // Live garden with no open chapter = between-show window
  return {
    mode: "between",
    canContribute: true,
    message: "Between shows — leave a mark and keep the garden alive.",
  };
}

/** Merge brand bloom storyboard into a WorldConfig for WorldStage when garden-linked. */
export function worldConfigFromBrand(brand: BrandKit, fallback: WorldConfig): WorldConfig {
  return {
    ...fallback,
    title: brand.title || fallback.title,
    logoUrl: fallback.logoUrl ?? brand.logoUrl,
    logoMaxWidthPx: fallback.logoMaxWidthPx ?? null,
    primaryColor: brand.primaryColor || fallback.primaryColor,
    accentColor: brand.accentColor || fallback.accentColor,
    heroArtworkUrl: brand.heroArtworkUrl ?? fallback.heroArtworkUrl,
    animationPreset: brand.animationPreset || fallback.animationPreset,
    ambientSoundtrackUrl: brand.ambientSoundtrackUrl ?? fallback.ambientSoundtrackUrl,
    brandOverlays: resolveBrandOverlays(brand),
    // Prefer garden bloom storyboard for shared energy; keep event storyboard if garden has none.
    worldStoryboard: brand.bloomStoryboard.length
      ? brand.bloomStoryboard
      : fallback.worldStoryboard,
  };
}
