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
import { siteUrl } from "@/lib/site-url";

const MAX_VIBE_CHARS = 360;
const MAX_REFS = 3;
const VIDEO_DURATION_SEC = 10;

/** Runway needs https/data URIs — expand site-relative paths. */
export function absoluteMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("runway://")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) return `${siteUrl()}${trimmed}`;
  return trimmed;
}

/**
 * Fetch an image and return a data URI so Runway doesn't need to crawl our CDN.
 * Falls back to the absolute URL if download fails.
 */
async function runwayImageUri(url: string): Promise<string> {
  const abs = absoluteMediaUrl(url);
  if (abs.startsWith("data:") || abs.startsWith("runway://")) return abs;
  try {
    const res = await fetch(abs);
    if (!res.ok) return abs;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return abs;
    const bytes = Buffer.from(await res.arrayBuffer());
    // Keep payloads reasonable for Runway request bodies.
    if (bytes.length > 4_500_000) return abs;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return abs;
  }
}

/** Models love inventing UI panels, scoreboard glyphs, and fake zone signage. */
const NO_TEXT_LOCK =
  "TEXT-FREE: no letters, numbers, words, logos, UI chrome, scoreboard glyphs, or gibberish. Zones = unlabeled color/glow patches only.";

const IMAGE_SUFFIX =
  "Flat top-down @venue-angle map, community pitch, open sidelines, tack-sharp stylized game-world art, no soft focus, no fog, no photoreal, no people, no seat numbers, no lettering.";

const MOTION_SUFFIX =
  "Subtle ambient motion only, slow drifting light and soft zone glow pulses, camera locked, seamless loop, sharp and clear, no soft focus, no haze, no people walking into frame, no text logos or UI.";

/** Hard anti-bias: models love inventing MLS bowls when they hear “stadium”. */
const TWIN_LOCK =
  "DIGITAL TWIN LOCK from @venue: copy REAL footprint — same camera, pitch size/orientation, open community field, parking, trees, tents, low buildings, sparse sideline seating. FORBIDDEN: stadium bowl, multi-tier grandstands, enclosed arena, inventing a bigger venue. Restyle materials/night energy only — luminous digital twin, not a photo.";

const VARIANT_MOOD: Record<Exclude<MapPlateVariantKey, "default">, string> = {
  kickoff:
    "Kickoff energy — floodlights rising, pitch freshly lit, anticipation, cooler blue hour warming into match light",
  goal: "Goal roar — explosive chartreuse and white light bloom along the real sidelines, victorious surge, electric night",
  halftime:
    "Halftime breath — softer sidelight, warm spill from concessions tents, quieter mid-match lull, still alive",
  rivalry:
    "Rivalry night — higher contrast, sharper accents, tense charged atmosphere, deeper shadows, fierce energy",
  night: "Night match — deep navy sky, bright pitch island, bioluminescent zone glows on the real footprint, cinematic darkness",
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

/**
 * M2 — precise authored layout for the prompt.
 * Deliberately omits zone names: listing “Beer Garden” etc. makes Runway paint fake signs.
 */
export function buildLayoutGuideClause(zones: ZoneDef[]): string {
  if (!zones.length) return "";
  const parts = zones.slice(0, 12).map((z) => {
    const pctX = Math.round(z.x * 100);
    const pctY = Math.round(z.y * 100);
    return `${pctX}% left / ${pctY}% top (${quadrant(z.x, z.y)})`;
  });
  return `Unlabeled zone glows (no words) at: ${parts.join("; ")}.`;
}

export function buildMapPlatePrompt(opts: {
  brand: Pick<BrandKit, "title" | "primaryColor" | "accentColor">;
  zones: ZoneDef[];
  vibePrompt: string;
  venueNotes?: string;
  referenceTags?: string[];
  layoutGuided?: boolean;
  twinMode?: boolean;
}): string {
  const twin = Boolean(opts.twinMode);
  const tags = opts.referenceTags ?? [];
  const hasVenue = tags.includes("venue");

  const zoneCount = opts.zones.filter((z) => z.label.trim() || z.key.trim()).length;
  const zoneClause =
    zoneCount > 0
      ? `${zoneCount} distinct unlabeled fan zones as painted color/glow regions (not seats, not banners, not lettered signs).`
      : "Imply a few unlabeled fan gathering zones as color patches around the pitch.";

  const layoutClause =
    opts.layoutGuided && opts.zones.length > 0 ? buildLayoutGuideClause(opts.zones) : "";

  const notes = opts.venueNotes?.trim()
    ? `Venue landmarks: ${condense(opts.venueNotes, twin ? 100 : 220)}.`
    : "";

  const refParts: string[] = [];
  if (twin && hasVenue) {
    // TWIN_LOCK is injected early below — keep only secondary ref cues here.
    if (tags.includes("layout")) {
      refParts.push("Use @layout only for fan-zone glow placement on @venue geometry.");
    }
    const extra = tags.filter((t) => t !== "layout" && t !== "venue");
    if (extra.length > 0) {
      refParts.push(
        `Also match structure from ${extra.map((t) => `@${t}`).join(", ")} (same pitch aerials).`
      );
    }
  } else {
    if (tags.includes("layout")) {
      refParts.push(
        "Follow @layout for zone placement — glowing blobs mark where each zone must sit."
      );
    }
    if (hasVenue) {
      refParts.push(
        "Take place and structure cues from @venue; stylize into Song Garden art rather than copying the photo."
      );
    }
    const other = tags.filter((t) => t !== "layout" && t !== "venue");
    if (other.length > 0) {
      refParts.push(
        `Also inspired by ${other.map((t) => `@${t}`).join(", ")} for atmosphere.`
      );
    }
    if (refParts.length === 0) {
      refParts.push("Invent a stylized stadium world map for this club.");
    }
  }

  const vibe = opts.vibePrompt.trim()
    ? condense(opts.vibePrompt, twin ? 160 : MAX_VIBE_CHARS)
    : `Matchday energy for ${opts.brand.title}, deep ${opts.brand.primaryColor} night with ${opts.brand.accentColor} accents.`;

  const twinLead = twin
    ? `Stylized digital twin of ${opts.brand.title}'s real community pitch — THIS open field, not a pro arena.`
    : `Crowdsource Fans Song Garden season map for ${opts.brand.title}.`;

  // Locks + style suffix are required; geometry cues fill remaining budget.
  const required = [
    `${vibe}.`,
    twinLead,
    NO_TEXT_LOCK,
    twin && hasVenue ? TWIN_LOCK : "",
    IMAGE_SUFFIX,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const optional = layoutClause
    ? [layoutClause, notes, refParts.join(" ")]
    : [zoneClause, notes, refParts.join(" ")];
  let out = required;
  for (const part of optional) {
    const p = part.trim();
    if (!p) continue;
    const next = `${out} ${p}`;
    if (next.length > 1000) continue;
    out = next;
  }
  return out.slice(0, 1000);
}

/**
 * Build Runway reference set.
 * Twin mode: @venue only (or venue + one extra photo). Skip the abstract layout
 * schematic PNG — it draws a generic pitch and pulls the model toward invented bowls.
 * Invent mode: @layout first (if guided), then place refs.
 */
export function buildMapPlateReferences(opts: {
  referenceUrls: string[];
  layoutSchematicUrl?: string | null;
  layoutGuided: boolean;
  twinMode: boolean;
}): RunwayReferenceImage[] {
  const refs: RunwayReferenceImage[] = [];
  const urls = opts.referenceUrls.map((u) => u.trim()).filter(Boolean);

  function push(uri: string, tag: string) {
    if (refs.length >= MAX_REFS) return;
    if (refs.some((r) => r.uri === uri || r.tag === tag)) return;
    refs.push({ uri: absoluteMediaUrl(uri), tag });
  }

  if (opts.twinMode && urls[0]) {
    // Venue photo dominates. Optional second real aerial can reinforce structure.
    push(urls[0], "venue");
    for (let i = 1; i < urls.length; i += 1) {
      push(urls[i], `ref${i + 1}`);
    }
    // Zone anchors stay in the text prompt — do not send schematic PNG in twin mode.
  } else {
    if (opts.layoutGuided && opts.layoutSchematicUrl) {
      push(opts.layoutSchematicUrl, "layout");
    }
    for (let i = 0; i < urls.length; i += 1) {
      push(urls[i], i === 0 ? "venue" : `ref${i + 1}`);
    }
  }

  return refs.slice(0, MAX_REFS);
}

export type GenerateMapPlateResult = {
  garden: Garden;
  draftUrl: string;
  promptText: string;
  layoutGuided: boolean;
  twinMode: boolean;
  layoutSchematicUrl: string | null;
};

export async function generateMapPlateDraft(
  garden: Garden,
  opts?: {
    vibePrompt?: string;
    venueNotes?: string;
    referenceUrls?: string[];
    seasonLabel?: string;
    /** Default true when zones exist. */
    layoutGuided?: boolean;
    /** Default true — stylized digital twin of the real venue. */
    twinMode?: boolean;
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
    venueNotes:
      opts?.venueNotes != null ? opts.venueNotes.trim() : garden.brandKit.mapPlate.venueNotes,
    seasonLabel:
      opts?.seasonLabel != null
        ? opts.seasonLabel.trim()
        : garden.brandKit.mapPlate.seasonLabel,
    twinMode:
      opts?.twinMode != null ? Boolean(opts.twinMode) : garden.brandKit.mapPlate.twinMode !== false,
  };

  const zones = garden.brandKit.zones;
  const layoutGuided =
    opts?.layoutGuided != null ? Boolean(opts.layoutGuided) : zones.length > 0;
  const twinMode = workingPlate.twinMode;

  if (twinMode && workingPlate.referenceUrls.length === 0) {
    throw new Error(
      "Digital twin mode needs at least one venue reference photo (the real stadium map or aerial)."
    );
  }

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
  }

  const referenceImages = buildMapPlateReferences({
    referenceUrls: workingPlate.referenceUrls,
    layoutSchematicUrl,
    layoutGuided,
    twinMode,
  });

  const promptText = buildMapPlatePrompt({
    brand: garden.brandKit,
    zones,
    vibePrompt: workingPlate.vibePrompt,
    venueNotes: workingPlate.venueNotes,
    referenceTags: referenceImages.map((r) => r.tag),
    layoutGuided,
    twinMode,
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
        twinMode,
        layoutSchematicUrl,
      },
    },
  });
  if (!updated) throw new Error("Garden not found after generate.");

  return {
    garden: updated,
    draftUrl,
    promptText,
    layoutGuided,
    twinMode,
    layoutSchematicUrl,
  };
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
  const promptText = `${condense(vibe)}. ${NO_TEXT_LOCK} ${MOTION_SUFFIX}`.slice(0, 1000);

  const runwayVideoUrl = await generateVideoFromImage({
    promptImage: await runwayImageUri(stillUrl),
    promptText,
    model: "gen4_turbo",
    duration: VIDEO_DURATION_SEC,
    ratio: "1280:720",
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

  const referenceImages: RunwayReferenceImage[] = [
    { uri: absoluteMediaUrl(baseStill), tag: "plate" },
  ];
  if (garden.brandKit.mapPlate.layoutSchematicUrl && referenceImages.length < MAX_REFS) {
    referenceImages.push({
      uri: absoluteMediaUrl(garden.brandKit.mapPlate.layoutSchematicUrl),
      tag: "layout",
    });
  }

  const promptText = `${condense(vibe || `${garden.brandKit.title} Song Garden`, 200)}. ${mood}. ${NO_TEXT_LOCK} Same continuous digital-twin stadium map as @plate — keep identical venue geometry, pitch orientation, stand silhouettes, and zone positions; only change lighting, atmosphere, and energy. ${layoutClause} ${IMAGE_SUFFIX}`
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
    const motionPrompt = `${condense(vibe || garden.brandKit.title)}. ${mood}. ${NO_TEXT_LOCK} ${MOTION_SUFFIX}`.slice(
      0,
      1000
    );
    const runwayVideoUrl = await generateVideoFromImage({
      promptImage: await runwayImageUri(stillUrl),
      promptText: motionPrompt,
      model: "gen4_turbo",
      duration: VIDEO_DURATION_SEC,
      ratio: "1280:720",
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
