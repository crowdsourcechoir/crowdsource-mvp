/**
 * Season map plate M1–M4:
 * M1 generate + pin still
 * M2 layout-guided generation (zone schematic @layout)
 * M3 ambient motion loop on pinned plate
 * M4 matchday variants (same layout / hit space)
 */

import {
  generateImageFromText,
  generateVideoFromImage,
  isRunwayConfigured,
  type RunwayReferenceImage,
} from "@/lib/song-garden-v2/runway";
import {
  persistGeneratedBytes,
  persistGeneratedMedia,
} from "@/lib/song-garden-v2/persist-generated-media";
import { buildLayoutSchematicPng } from "@/lib/song-garden-v2/garden/layout-schematic";
import { updateGarden } from "@/lib/song-garden-v2/garden/store";
import type {
  BrandKit,
  Garden,
  MapPlateMeta,
  MapPlateVariant,
  MapPlateVariantKey,
  ZoneDef,
} from "@/lib/song-garden-v2/garden/types";
import { MAP_PLATE_VARIANT_LABELS } from "@/lib/song-garden-v2/garden/types";

const MAX_VIBE_CHARS = 360;
const MAX_REFS = 3;
const VIDEO_DURATION_SEC = 10;

const IMAGE_SUFFIX =
  "Premium cinematic wide stadium participation map concept art, top-down or elevated schematic of a sports venue and surrounding fan zones, tack-sharp focus, high detail, crisp textures, no soft focus, no heavy fog, no people in foreground, no readable text or logos, no seat numbers; follow the vibe prompt color palette.";

const MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light and soft zone glow pulses, camera locked in place, seamless looping atmosphere, keep the scene sharp and clear, no soft focus, no heavy haze or blur, no people walking into frame, no text or logos.";

const VARIANT_MOOD: Record<Exclude<MapPlateVariantKey, "default">, string> = {
  kickoff:
    "Kickoff energy — floodlights rising, pitch freshly lit, anticipation, cooler blue hour warming into match light",
  goal: "Goal roar — explosive chartreuse and white light bloom from the stands, victorious surge, electric night",
  halftime:
    "Halftime breath — softer sidelight, warm spill from concessions, quieter mid-match lull, still alive",
  rivalry:
    "Rivalry night — higher contrast, sharper accents, tense charged atmosphere, deeper shadows, fierce energy",
  night: "Night match — deep navy sky, bright pitch island, bioluminescent zone glows, cinematic darkness",
};

function condense(text: string, max = MAX_VIBE_CHARS): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

function quadrant(x: number, y: number): string {
  const lr = x < 0.4 ? "left" : x > 0.6 ? "right" : "center";
  const tb = y < 0.4 ? "upper" : y > 0.6 ? "lower" : "mid";
  return `${tb}-${lr}`;
}

/** M2 — precise authored layout for the prompt. */
export function buildLayoutGuideClause(zones: ZoneDef[]): string {
  if (!zones.length) return "";
  const parts = zones.slice(0, 12).map((z) => {
    const pctX = Math.round(z.x * 100);
    const pctY = Math.round(z.y * 100);
    return `${z.label} at ${pctX}% from left, ${pctY}% from top (${quadrant(z.x, z.y)})`;
  });
  return `Respect this exact fan-zone layout (painted regions, not seats): ${parts.join("; ")}. Keep the pitch/central field near the middle; place each named zone where listed so tap targets stay aligned.`;
}

export function buildMapPlatePrompt(opts: {
  brand: Pick<BrandKit, "title" | "primaryColor" | "accentColor">;
  zones: ZoneDef[];
  vibePrompt: string;
  referenceTags?: string[];
  layoutGuided?: boolean;
}): string {
  const zoneList = opts.zones
    .map((z) => z.label.trim())
    .filter(Boolean)
    .slice(0, 12);
  const zoneClause =
    zoneList.length > 0
      ? `Named fan participation zones as distinct painted areas (not seats): ${zoneList.join(", ")}.`
      : "Imply a few distinct fan gathering zones around the pitch.";

  const layoutClause =
    opts.layoutGuided && opts.zones.length > 0 ? buildLayoutGuideClause(opts.zones) : "";

  const refParts: string[] = [];
  if (opts.referenceTags?.includes("layout")) {
    refParts.push(
      "Follow @layout for zone placement — glowing blobs mark where each zone must sit; invent rich stadium art that matches those positions."
    );
  }
  const placeTags = (opts.referenceTags ?? []).filter((t) => t !== "layout");
  if (placeTags.length > 0) {
    refParts.push(
      `Inspired by ${placeTags.map((t) => `@${t}`).join(", ")} — place/atmosphere reference; invent a new Song Garden map plate rather than copying any photo literally.`
    );
  }
  if (refParts.length === 0) {
    refParts.push("Invent a stylized stadium world map for this club.");
  }

  const vibe = opts.vibePrompt.trim()
    ? condense(opts.vibePrompt)
    : `Matchday energy for ${opts.brand.title}, deep ${opts.brand.primaryColor} night with ${opts.brand.accentColor} accents.`;

  return `${vibe}. Crowdsource Fans Song Garden season map for ${opts.brand.title}. ${zoneClause} ${layoutClause} ${refParts.join(" ")} ${IMAGE_SUFFIX}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function placeRefsFromPlate(plate: MapPlateMeta): RunwayReferenceImage[] {
  const out: RunwayReferenceImage[] = [];
  for (let i = 0; i < plate.referenceUrls.length && out.length < MAX_REFS; i += 1) {
    const uri = plate.referenceUrls[i]?.trim();
    if (!uri) continue;
    out.push({ uri, tag: `ref${i + 1}` });
  }
  return out;
}

export type GenerateMapPlateResult = {
  garden: Garden;
  draftUrl: string;
  promptText: string;
  layoutGuided: boolean;
  layoutSchematicUrl: string | null;
};

export async function generateMapPlateDraft(
  garden: Garden,
  opts?: {
    vibePrompt?: string;
    referenceUrls?: string[];
    seasonLabel?: string;
    /** Default true when zones exist. */
    layoutGuided?: boolean;
  }
): Promise<GenerateMapPlateResult> {
  if (!isRunwayConfigured()) {
    throw new Error("Runway is not configured. Add RUNWAYML_API_SECRET to env and restart.");
  }

  const workingPlate: MapPlateMeta = {
    ...garden.brandKit.mapPlate,
    referenceUrls:
      opts?.referenceUrls != null
        ? opts.referenceUrls.map((u) => u.trim()).filter(Boolean).slice(0, 8)
        : garden.brandKit.mapPlate.referenceUrls,
    vibePrompt:
      opts?.vibePrompt != null ? opts.vibePrompt.trim() : garden.brandKit.mapPlate.vibePrompt,
    seasonLabel:
      opts?.seasonLabel != null
        ? opts.seasonLabel.trim()
        : garden.brandKit.mapPlate.seasonLabel,
  };

  const zones = garden.brandKit.zones;
  const layoutGuided =
    opts?.layoutGuided != null ? Boolean(opts.layoutGuided) : zones.length > 0;

  const referenceImages: RunwayReferenceImage[] = [];
  let layoutSchematicUrl: string | null = workingPlate.layoutSchematicUrl;

  if (layoutGuided && zones.length > 0) {
    const png = buildLayoutSchematicPng({
      zones,
      primaryColor: garden.brandKit.primaryColor,
      accentColor: garden.brandKit.accentColor,
    });
    layoutSchematicUrl = await persistGeneratedBytes(
      png,
      `garden-${garden.id}-layout-${Date.now()}.png`,
      "image/png"
    );
    referenceImages.push({ uri: layoutSchematicUrl, tag: "layout" });
  }

  for (const ref of placeRefsFromPlate(workingPlate)) {
    if (referenceImages.length >= MAX_REFS) break;
    referenceImages.push(ref);
  }

  const promptText = buildMapPlatePrompt({
    brand: garden.brandKit,
    zones,
    vibePrompt: workingPlate.vibePrompt,
    referenceTags: referenceImages.map((r) => r.tag),
    layoutGuided,
  });

  const runwayUrl = await generateImageFromText({
    promptText,
    model: "gen4_image",
    ratio: "1920:1080",
    ...(referenceImages.length ? { referenceImages } : {}),
  });

  const filename = `garden-${garden.id}-map-plate-${Date.now()}.jpg`;
  const draftUrl = await persistGeneratedMedia(runwayUrl, filename, "image/jpeg");
  const now = new Date().toISOString();

  const updated = await updateGarden(garden.id, {
    brandKit: {
      mapPlate: {
        ...workingPlate,
        draftUrl,
        draftGeneratedAt: now,
        layoutGuided,
        layoutSchematicUrl,
      },
    },
  });
  if (!updated) throw new Error("Garden not found after generate.");

  return { garden: updated, draftUrl, promptText, layoutGuided, layoutSchematicUrl };
}

export type PinMapPlateResult = {
  garden: Garden;
  plateUrl: string;
};

/**
 * Pin draft (or explicit URL) as the live season map. Zones / hits are untouched.
 * Replacing the plate clears ambient video (M3) so motion stays in sync with art.
 */
export async function pinMapPlate(
  garden: Garden,
  opts?: { url?: string; seasonLabel?: string; confirmReplace?: boolean }
): Promise<PinMapPlateResult> {
  const plateUrl = (opts?.url ?? garden.brandKit.mapPlate.draftUrl)?.trim() || null;
  if (!plateUrl) {
    throw new Error("No draft map plate to pin. Generate one first.");
  }

  const current = garden.brandKit.heroArtworkUrl?.trim() || null;
  if (
    current &&
    current !== plateUrl &&
    opts?.confirmReplace !== true &&
    garden.brandKit.mapPlate.pinnedAt
  ) {
    throw new Error("A season plate is already pinned. Pass confirmReplace to replace it.");
  }

  const replacing = Boolean(current && current !== plateUrl);
  const now = new Date().toISOString();
  const updated = await updateGarden(garden.id, {
    brandKit: {
      heroArtworkUrl: plateUrl,
      mapPlate: {
        ...garden.brandKit.mapPlate,
        draftUrl: garden.brandKit.mapPlate.draftUrl || plateUrl,
        pinnedAt: now,
        seasonLabel:
          opts?.seasonLabel?.trim() || garden.brandKit.mapPlate.seasonLabel || "",
        // New still → drop old motion; variants stay until admin regenerates.
        ambientVideoUrl: replacing ? null : garden.brandKit.mapPlate.ambientVideoUrl,
        ambientVideoGeneratedAt: replacing
          ? null
          : garden.brandKit.mapPlate.ambientVideoGeneratedAt,
        activeVariantKey: replacing ? null : garden.brandKit.mapPlate.activeVariantKey,
      },
    },
  });
  if (!updated) throw new Error("Garden not found after pin.");
  return { garden: updated, plateUrl };
}

export type GenerateMotionResult = {
  garden: Garden;
  ambientVideoUrl: string;
};

/** M3 — ambient loop from the pinned season still (or explicit still URL). */
export async function generateMapPlateMotion(
  garden: Garden,
  opts?: { stillUrl?: string }
): Promise<GenerateMotionResult> {
  if (!isRunwayConfigured()) {
    throw new Error("Runway is not configured. Add RUNWAYML_API_SECRET to env and restart.");
  }

  const stillUrl =
    (opts?.stillUrl ?? garden.brandKit.heroArtworkUrl)?.trim() ||
    garden.brandKit.mapPlate.draftUrl?.trim() ||
    null;
  if (!stillUrl) {
    throw new Error("Pin a season map plate before generating ambient motion.");
  }

  const vibe =
    garden.brandKit.mapPlate.vibePrompt.trim() ||
    `${garden.brandKit.title} matchday atmosphere`;
  const promptText = `${condense(vibe)}. ${MOTION_SUFFIX}`.slice(0, 1000);

  const runwayVideoUrl = await generateVideoFromImage({
    promptImage: stillUrl,
    promptText,
    model: "gen4_turbo",
    duration: VIDEO_DURATION_SEC,
    ratio: "1920:1080",
  });
  const videoFilename = `garden-${garden.id}-map-ambient-${Date.now()}.mp4`;
  const ambientVideoUrl = await persistGeneratedMedia(
    runwayVideoUrl,
    videoFilename,
    "video/mp4"
  );
  const now = new Date().toISOString();

  const updated = await updateGarden(garden.id, {
    brandKit: {
      mapPlate: {
        ...garden.brandKit.mapPlate,
        ambientVideoUrl,
        ambientVideoGeneratedAt: now,
      },
    },
  });
  if (!updated) throw new Error("Garden not found after motion generate.");
  return { garden: updated, ambientVideoUrl };
}

export type GenerateVariantResult = {
  garden: Garden;
  variant: MapPlateVariant;
};

/** M4 — matchday variant still (+ optional motion) from the pinned plate. */
export async function generateMapPlateVariant(
  garden: Garden,
  opts: {
    key: Exclude<MapPlateVariantKey, "default">;
    withMotion?: boolean;
  }
): Promise<GenerateVariantResult> {
  if (!isRunwayConfigured()) {
    throw new Error("Runway is not configured. Add RUNWAYML_API_SECRET to env and restart.");
  }

  const baseStill = garden.brandKit.heroArtworkUrl?.trim() || null;
  if (!baseStill) {
    throw new Error("Pin a season map plate before generating matchday variants.");
  }

  const key = opts.key;
  const mood = VARIANT_MOOD[key];
  const vibe = garden.brandKit.mapPlate.vibePrompt.trim();
  const layoutClause = buildLayoutGuideClause(garden.brandKit.zones);

  const referenceImages: RunwayReferenceImage[] = [{ uri: baseStill, tag: "plate" }];
  if (garden.brandKit.mapPlate.layoutSchematicUrl && referenceImages.length < MAX_REFS) {
    referenceImages.push({
      uri: garden.brandKit.mapPlate.layoutSchematicUrl,
      tag: "layout",
    });
  }

  const promptText = `${condense(vibe || `${garden.brandKit.title} Song Garden`)}. ${mood}. Same continuous stadium map as @plate — keep identical layout, zone positions, and composition; only change lighting, atmosphere, and energy. ${layoutClause} ${IMAGE_SUFFIX}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);

  const runwayImageUrl = await generateImageFromText({
    promptText,
    model: "gen4_image",
    ratio: "1920:1080",
    referenceImages,
  });
  const stillFilename = `garden-${garden.id}-variant-${key}-${Date.now()}.jpg`;
  const stillUrl = await persistGeneratedMedia(runwayImageUrl, stillFilename, "image/jpeg");

  let videoUrl: string | null = null;
  if (opts.withMotion) {
    const motionPrompt = `${condense(vibe || garden.brandKit.title)}. ${mood}. ${MOTION_SUFFIX}`.slice(
      0,
      1000
    );
    const runwayVideoUrl = await generateVideoFromImage({
      promptImage: stillUrl,
      promptText: motionPrompt,
      model: "gen4_turbo",
      duration: VIDEO_DURATION_SEC,
      ratio: "1920:1080",
    });
    videoUrl = await persistGeneratedMedia(
      runwayVideoUrl,
      `garden-${garden.id}-variant-${key}-${Date.now()}.mp4`,
      "video/mp4"
    );
  }

  const variant: MapPlateVariant = {
    key,
    label: MAP_PLATE_VARIANT_LABELS[key],
    stillUrl,
    videoUrl,
    generatedAt: new Date().toISOString(),
  };

  const variants = [
    ...garden.brandKit.mapPlate.variants.filter((v) => v.key !== key),
    variant,
  ];

  const updated = await updateGarden(garden.id, {
    brandKit: {
      mapPlate: {
        ...garden.brandKit.mapPlate,
        variants,
      },
    },
  });
  if (!updated) throw new Error("Garden not found after variant generate.");
  return { garden: updated, variant };
}

export async function setActiveMapPlateVariant(
  garden: Garden,
  key: MapPlateVariantKey | null
): Promise<Garden> {
  if (key && key !== "default") {
    const found = garden.brandKit.mapPlate.variants.some((v) => v.key === key);
    if (!found) {
      throw new Error(`Variant “${key}” is not generated yet.`);
    }
  }
  const updated = await updateGarden(garden.id, {
    brandKit: {
      mapPlate: {
        ...garden.brandKit.mapPlate,
        activeVariantKey: key === "default" ? null : key,
      },
    },
  });
  if (!updated) throw new Error("Garden not found after setting variant.");
  return updated;
}
