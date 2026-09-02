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
import { resolveAtmosphere } from "./types";

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
    message: "Between shows — plant a seed and keep the garden alive.",
  };
}

/** Merge brand into WorldConfig for WorldStage — atmosphere drives the living background. */
export function worldConfigFromBrand(brand: BrandKit, fallback: WorldConfig): WorldConfig {
  const atm = resolveAtmosphere(brand);
  const base: WorldConfig = {
    ...fallback,
    title: brand.title || fallback.title,
    logoUrl: fallback.logoUrl ?? brand.logoUrl,
    logoMaxWidthPx: fallback.logoMaxWidthPx ?? null,
    primaryColor: brand.primaryColor || fallback.primaryColor,
    accentColor: brand.accentColor || fallback.accentColor,
    animationPreset: brand.animationPreset || fallback.animationPreset,
    ambientSoundtrackUrl: brand.ambientSoundtrackUrl ?? fallback.ambientSoundtrackUrl,
    worldStoryboard: brand.bloomStoryboard.length
      ? brand.bloomStoryboard
      : fallback.worldStoryboard,
    heroArtworkUrl: brand.heroArtworkUrl ?? fallback.heroArtworkUrl,
  };

  if (atm.mode === "brand_wash") {
    return {
      ...base,
      heroArtworkUrl: null,
      worldStoryboard: [],
    };
  }

  if (atm.mode === "gaussian") {
    // Soft immersive placeholder until gaussian assets ship — aurora field, no hard photo.
    return {
      ...base,
      heroArtworkUrl: null,
      worldStoryboard: [],
      animationPreset: "aurora",
    };
  }

  if (atm.mode === "vibe_video") {
    const videoUrl = atm.videoUrl || brand.mapPlate.ambientVideoUrl?.trim() || null;
    const poster =
      atm.posterUrl || atm.stillUrl || brand.heroArtworkUrl || fallback.heroArtworkUrl;
    if (videoUrl) {
      return {
        ...base,
        heroArtworkUrl: poster,
        worldStoryboard: [
          {
            sceneUrl: poster,
            videoUrl,
            energy: 0,
          },
        ],
      };
    }
    return {
      ...base,
      heroArtworkUrl: poster,
      worldStoryboard: brand.bloomStoryboard.length ? brand.bloomStoryboard : [],
    };
  }

  if (atm.mode === "static_photo") {
    const still = atm.stillUrl || brand.heroArtworkUrl || fallback.heroArtworkUrl;
    return {
      ...base,
      heroArtworkUrl: still,
      worldStoryboard: [],
    };
  }

  // map_plate — prefer pinned/live map still; ambient video if present
  const mapStill =
    atm.stillUrl || brand.heroArtworkUrl || fallback.heroArtworkUrl;
  const mapVideo = atm.videoUrl || brand.mapPlate.ambientVideoUrl?.trim() || null;
  if (mapVideo) {
    return {
      ...base,
      heroArtworkUrl: mapStill,
      worldStoryboard: [
        {
          sceneUrl: mapStill,
          videoUrl: mapVideo,
          energy: 0,
        },
      ],
    };
  }
  return {
    ...base,
    heroArtworkUrl: mapStill,
    worldStoryboard: brand.bloomStoryboard.length ? brand.bloomStoryboard : [],
  };
}
