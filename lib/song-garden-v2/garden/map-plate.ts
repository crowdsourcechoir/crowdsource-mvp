/**
 * M1 — Season map plate: invent a still from brand + zones + vibe (+ optional refs),
 * persist it as a draft, then pin to `brandKit.heroArtworkUrl` for the season.
 * Regenerating drafts must not wipe zone hit regions.
 */

import {
  generateImageFromText,
  isRunwayConfigured,
  type RunwayReferenceImage,
} from "@/lib/song-garden-v2/runway";
import { persistGeneratedMedia } from "@/lib/song-garden-v2/persist-generated-media";
import { updateGarden } from "@/lib/song-garden-v2/garden/store";
import type { BrandKit, Garden, MapPlateMeta, ZoneDef } from "@/lib/song-garden-v2/garden/types";

const MAX_VIBE_CHARS = 420;
const MAX_REFS = 3;
const IMAGE_SUFFIX =
  "Premium cinematic wide stadium participation map concept art, top-down or elevated schematic of a sports venue and surrounding fan zones, tack-sharp focus, high detail, crisp textures, no soft focus, no heavy fog, no people in foreground, no readable text or logos, no seat numbers; follow the vibe prompt color palette.";

function condense(text: string, max = MAX_VIBE_CHARS): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

export function buildMapPlatePrompt(opts: {
  brand: Pick<BrandKit, "title" | "primaryColor" | "accentColor">;
  zones: ZoneDef[];
  vibePrompt: string;
  referenceTags?: string[];
}): string {
  const zoneList = opts.zones
    .map((z) => z.label.trim())
    .filter(Boolean)
    .slice(0, 12);
  const zoneClause =
    zoneList.length > 0
      ? `Named fan participation zones to imply as distinct painted areas (not seats): ${zoneList.join(", ")}.`
      : "Imply a few distinct fan gathering zones around the pitch.";

  const refClause =
    opts.referenceTags && opts.referenceTags.length > 0
      ? `Inspired by ${opts.referenceTags.map((t) => `@${t}`).join(", ")} — use as place/atmosphere reference; invent a new Song Garden map plate rather than copying any photo literally.`
      : "Invent a stylized stadium world map for this club.";

  const vibe = opts.vibePrompt.trim()
    ? condense(opts.vibePrompt)
    : `Matchday energy for ${opts.brand.title}, deep ${opts.brand.primaryColor} night with ${opts.brand.accentColor} accents.`;

  return `${vibe}. Crowdsource Fans Song Garden season map for ${opts.brand.title}. ${zoneClause} ${refClause} ${IMAGE_SUFFIX}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function refsFromPlate(plate: MapPlateMeta): RunwayReferenceImage[] {
  const out: RunwayReferenceImage[] = [];
  for (let i = 0; i < plate.referenceUrls.length && out.length < MAX_REFS; i += 1) {
    const uri = plate.referenceUrls[i]?.trim();
    if (!uri) continue;
    // Tags: 3–15 alphanumeric, start with a letter (Runway requirement).
    out.push({ uri, tag: `ref${i + 1}` });
  }
  return out;
}

export type GenerateMapPlateResult = {
  garden: Garden;
  draftUrl: string;
  promptText: string;
};

export async function generateMapPlateDraft(garden: Garden, opts?: {
  vibePrompt?: string;
  referenceUrls?: string[];
  seasonLabel?: string;
}): Promise<GenerateMapPlateResult> {
  if (!isRunwayConfigured()) {
    throw new Error(
      "Runway is not configured. Add RUNWAYML_API_SECRET to env and restart."
    );
  }

  const platePatch: Partial<MapPlateMeta> = {};
  if (opts?.vibePrompt != null) platePatch.vibePrompt = opts.vibePrompt;
  if (opts?.referenceUrls != null) platePatch.referenceUrls = opts.referenceUrls;
  if (opts?.seasonLabel != null) platePatch.seasonLabel = opts.seasonLabel;

  const workingPlate: MapPlateMeta = {
    ...garden.brandKit.mapPlate,
    ...platePatch,
    referenceUrls:
      opts?.referenceUrls != null
        ? opts.referenceUrls.map((u) => u.trim()).filter(Boolean).slice(0, 8)
        : garden.brandKit.mapPlate.referenceUrls,
    vibePrompt:
      opts?.vibePrompt != null ? opts.vibePrompt.trim() : garden.brandKit.mapPlate.vibePrompt,
  };

  const referenceImages = refsFromPlate(workingPlate);
  const promptText = buildMapPlatePrompt({
    brand: garden.brandKit,
    zones: garden.brandKit.zones,
    vibePrompt: workingPlate.vibePrompt,
    referenceTags: referenceImages.map((r) => r.tag),
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
      },
    },
  });
  if (!updated) throw new Error("Garden not found after generate.");

  return { garden: updated, draftUrl, promptText };
}

export type PinMapPlateResult = {
  garden: Garden;
  plateUrl: string;
};

/**
 * Pin draft (or explicit URL) as the live season map. Zones / hits are untouched.
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
    throw new Error(
      "A season plate is already pinned. Pass confirmReplace to replace it."
    );
  }

  const now = new Date().toISOString();
  const updated = await updateGarden(garden.id, {
    brandKit: {
      heroArtworkUrl: plateUrl,
      mapPlate: {
        ...garden.brandKit.mapPlate,
        draftUrl: garden.brandKit.mapPlate.draftUrl || plateUrl,
        pinnedAt: now,
        seasonLabel:
          opts?.seasonLabel?.trim() ||
          garden.brandKit.mapPlate.seasonLabel ||
          "",
      },
    },
  });
  if (!updated) throw new Error("Garden not found after pin.");
  return { garden: updated, plateUrl };
}
