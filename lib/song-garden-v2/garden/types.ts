import type { WorldStoryboardFrame } from "@/lib/song-garden-v2/world-config";

export type GardenKind = "series" | "season" | "evergreen";
export type GardenStatus = "draft" | "live" | "archived";
export type ChapterStatus = "upcoming" | "open" | "closed";

export type ContributionKind =
  | "text"
  | "voice"
  | "video"
  | "percussion"
  | "vocal"
  | "other";

/**
 * Season map plate workflow (M1–M4):
 * M1 pin still · M2 layout-guided gen · M3 ambient loop · M4 matchday variants.
 * Draft is preview-only until pinned; pin writes `heroArtworkUrl` and must not
 * clear zone hit regions.
 */
export type MapPlateVariantKey =
  | "default"
  | "kickoff"
  | "goal"
  | "halftime"
  | "rivalry"
  | "night";

export type MapPlateVariant = {
  key: MapPlateVariantKey;
  label: string;
  stillUrl: string;
  videoUrl: string | null;
  generatedAt: string;
};

export type MapPlateMeta = {
  /** Place / atmosphere reference photos (Runway uses up to 3). First URL is the venue lock in twin mode. */
  referenceUrls: string[];
  /** Season vibe brief for generation. */
  vibePrompt: string;
  /**
   * Recognizable venue landmarks for twin mode (pitch orientation, stands, parking, trees…).
   * Free text — helps the model keep the real stadium’s identity without going photoreal.
   */
  venueNotes: string;
  /**
   * Stylized digital twin: lock real stadium geometry from the first reference;
   * restyle materials/lighting into a game-world Song Garden (not invent a new venue).
   */
  twinMode: boolean;
  /** Last generated still — not live until pinned. */
  draftUrl: string | null;
  draftGeneratedAt: string | null;
  /** When current heroArtworkUrl was pinned as the season plate. */
  pinnedAt: string | null;
  /** Human label, e.g. "2026 season". */
  seasonLabel: string;
  /** M2 — last draft/pin used zone layout schematic as a Runway reference. */
  layoutGuided: boolean;
  /** M2 — persisted schematic used for the last layout-guided generate (optional). */
  layoutSchematicUrl: string | null;
  /** M3 — looping ambient video for the pinned (or active variant) plate. */
  ambientVideoUrl: string | null;
  ambientVideoGeneratedAt: string | null;
  /** M4 — matchday still/video variants; hit regions stay on base plate space. */
  variants: MapPlateVariant[];
  /** M4 — which variant `/g` shows; null/default → heroArtworkUrl. */
  activeVariantKey: MapPlateVariantKey | null;
};

export const MAP_PLATE_VARIANT_KEYS: MapPlateVariantKey[] = [
  "default",
  "kickoff",
  "goal",
  "halftime",
  "rivalry",
  "night",
];

export const MAP_PLATE_VARIANT_LABELS: Record<MapPlateVariantKey, string> = {
  default: "Default season",
  kickoff: "Kickoff",
  goal: "Goal roar",
  halftime: "Halftime",
  rivalry: "Rivalry night",
  night: "Night match",
};

export type BrandKit = {
  title: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  /** Pinned season map plate (or manual map URL). Public `/g` reads this. */
  heroArtworkUrl: string | null;
  animationPreset: "particles" | "aurora" | "glow" | "none";
  ambientSoundtrackUrl: string | null;
  bloomStoryboard: WorldStoryboardFrame[];
  /**
   * Crowdsource Fans schematic participation map (not a literal seat map).
   * Choir/conference gardens may leave this empty.
   */
  zones: ZoneDef[];
  /** Optional sponsor catalog referenced by zone.sponsorKey */
  sponsors: SponsorDef[];
  /** Generate + pin workflow for the season map plate. */
  mapPlate: MapPlateMeta;
  /**
   * Center-stage atmosphere for the Garden / Bloom presentation.
   * Map-stage still uses mapPlate for the interactive plate; atmosphere
   * drives WorldStage behind prompts when not in map chrome.
   */
  atmosphere: GardenAtmosphere;
  /**
   * Fan-facing eyebrow on `/g` (defaults to brand title when null/empty).
   * Editable in live edit by hovering/tapping the eyebrow.
   */
  presenceEyebrow: string | null;
  /**
   * Supporting line under the eyebrow on `/g` (defaults to contribution window
   * message / season label when null/empty).
   */
  presenceMessage: string | null;
};

/** How the living background presents (pluggable — not video-only). */
export type AtmosphereMode =
  | "vibe_video"
  | "static_photo"
  | "map_plate"
  | "gaussian"
  | "brand_wash";

export type GardenAtmosphere = {
  mode: AtmosphereMode;
  /** Still image (static_photo / poster). */
  stillUrl: string | null;
  /** Looping video (vibe_video). */
  videoUrl: string | null;
  /** Poster frame while video loads. */
  posterUrl: string | null;
  /** Prompt used (or to use) for vibe video generation. */
  vibePrompt: string;
};

export const ATMOSPHERE_MODE_LABELS: Record<AtmosphereMode, string> = {
  vibe_video: "Vibe video loop",
  static_photo: "Static photo",
  map_plate: "Map / season plate",
  gaussian: "Gaussian environment",
  brand_wash: "Brand wash",
};

export function defaultAtmosphere(partial?: Partial<GardenAtmosphere> | null): GardenAtmosphere {
  const mode = partial?.mode;
  const valid: AtmosphereMode =
    mode === "vibe_video" ||
    mode === "static_photo" ||
    mode === "map_plate" ||
    mode === "gaussian" ||
    mode === "brand_wash"
      ? mode
      : "brand_wash";
  return {
    mode: valid,
    stillUrl: partial?.stillUrl?.trim() || null,
    videoUrl: partial?.videoUrl?.trim() || null,
    posterUrl: partial?.posterUrl?.trim() || null,
    vibePrompt: typeof partial?.vibePrompt === "string" ? partial.vibePrompt : "",
  };
}

/**
 * Prefer explicit atmosphere; for legacy gardens without one, infer from map/hero
 * so existing art keeps showing.
 */
export function resolveAtmosphere(brand: {
  atmosphere?: GardenAtmosphere | null;
  heroArtworkUrl?: string | null;
  mapPlate?: MapPlateMeta | null;
}): GardenAtmosphere {
  if (brand.atmosphere?.mode) {
    return defaultAtmosphere(brand.atmosphere);
  }
  const video = brand.mapPlate?.ambientVideoUrl?.trim() || null;
  const still =
    brand.heroArtworkUrl?.trim() ||
    brand.mapPlate?.draftUrl?.trim() ||
    null;
  if (video) {
    return defaultAtmosphere({
      mode: "vibe_video",
      videoUrl: video,
      posterUrl: still,
      stillUrl: still,
      vibePrompt: brand.mapPlate?.vibePrompt ?? "",
    });
  }
  if (still) {
    return defaultAtmosphere({
      mode: brand.mapPlate?.pinnedAt ? "map_plate" : "static_photo",
      stillUrl: still,
      posterUrl: still,
      vibePrompt: brand.mapPlate?.vibePrompt ?? "",
    });
  }
  return defaultAtmosphere({ mode: "brand_wash" });
}

export type ZoneHitPoint = { x: number; y: number };

/**
 * Clickable area on the map (the painted zone), not the label bubble.
 * Coordinates are 0..1 in map image space (same as x/y).
 */
export type ZoneHitRegion =
  | { type: "circle"; /** Radius in map-normalized units (0..~0.5) */ r: number }
  | { type: "polygon"; points: ZoneHitPoint[] };

export type ZoneDef = {
  key: string;
  label: string;
  /** Optional sponsor owning/enabling this zone */
  sponsorKey?: string | null;
  /** Label anchor 0..1 on the map */
  x: number;
  y: number;
  /** Optional zone / partner mark shown in the engage sheet */
  logoUrl?: string | null;
  /**
   * Clickable painted region. If omitted, a small circle around x/y is used.
   */
  hit?: ZoneHitRegion | null;
  /** Short hint shown on the public map */
  blurb?: string | null;
  /**
   * Fan-facing prompt for this zone (chant idea, check-in, etc.).
   * The map interaction surface shows this when the zone is selected.
   */
  prompt?: string | null;
  /** Primary CTA label, e.g. "Plant a seed" / "Share your chant" */
  ctaLabel?: string | null;
  /** Placeholder for the inline response field */
  inputPlaceholder?: string | null;
};

export type SponsorDef = {
  key: string;
  name: string;
  logoUrl?: string | null;
  /** Soft in-world credit, e.g. "Enabled by…" */
  credit?: string | null;
};

export type ZoneRuntimeState = {
  energy: number;
  contributions: number;
  lastContributionAt: string | null;
};

export type LandmarkPolicy = {
  key: string;
  label: string;
  minEnergy?: number;
  minContributions?: number;
  minChapterIndex?: number;
};

export type MutationPolicy = {
  energyPerContribution: number;
  energyCap: number;
  layerGain: number;
  layerCap: number;
  chapterWeightDefault: number;
  /** Weight for between-show pulses when no chapter is open (garden status live). */
  betweenChapterWeight: number;
  /** Extra weight applied once when a chapter is finalized. */
  chapterFinaleWeight: number;
  landmarks: LandmarkPolicy[];
  maxNodes: number;
  nodeWeight: number;
  deviceDamping: {
    windowMinutes: number;
    afterCount: number;
    factor: number;
  };
};

export type SharedGrowthNode = {
  id: string;
  kind: ContributionKind;
  index: number;
  weight: number;
  chapterId: string | null;
  zoneKey: string | null;
  createdAt: string;
};

export type Landmark = {
  id: string;
  key: string;
  label: string;
  unlockedAt: string;
  unlockedBy: "threshold" | "chapter" | "manual";
};

export type WorldState = {
  version: number;
  updatedAt: string;
  energy: number;
  totals: {
    contributions: number;
    participants: number;
    byKind: Partial<Record<ContributionKind, number>>;
  };
  field: {
    nodes: SharedGrowthNode[];
    nextIndex: number;
  };
  landmarks: Landmark[];
  layers: Record<ContributionKind, number>;
  chapters: {
    completedIds: string[];
    activeChapterId: string | null;
  };
  /** Per-zone vitality for Fans schematic map */
  zones: Record<string, ZoneRuntimeState>;
  renderSeed: string;
};

export type WorldEffect =
  | { type: "energy_up"; delta: number }
  | { type: "layer_up"; kind: ContributionKind; level: number }
  | { type: "landmark_unlocked"; key: string; label: string }
  | { type: "chapter_bloom"; chapterId: string }
  | { type: "zone_up"; zoneKey: string; energy: number; contributions: number };

export type Garden = {
  id: string;
  slug: string;
  title: string;
  kind: GardenKind;
  status: GardenStatus;
  brandKit: BrandKit;
  worldState: WorldState;
  worldVersion: number;
  mutationPolicy: MutationPolicy;
  commerce: unknown | null;
  createdAt: string;
  updatedAt: string;
};

export type GardenChapter = {
  id: string;
  gardenId: string;
  eventId: string;
  index: number;
  label: string;
  opensAt: string | null;
  closesAt: string | null;
  chapterWeight: number;
  status: ChapterStatus;
};

export type GardenSourceType = "clip" | "turn" | "pulse" | "finale";

export type ParticipantMark = {
  id: string;
  gardenId: string;
  deviceId: string;
  kind: ContributionKind;
  index: number;
  sourceType: GardenSourceType;
  sourceId: string;
  createdAt: string;
};

export type GardenMutationRecord = {
  id: string;
  gardenId: string;
  chapterId: string | null;
  deviceId: string | null;
  kind: ContributionKind;
  sourceType: GardenSourceType;
  sourceId: string;
  delta: Record<string, unknown>;
  effects: WorldEffect[];
  worldVersion: number;
  createdAt: string;
};

export type GardenSnapshot = {
  garden: {
    id: string;
    slug: string;
    title: string;
    kind: GardenKind;
    status: GardenStatus;
    worldVersion: number;
  };
  brand: BrandKit;
  state: WorldState;
  activeChapter: null | {
    id: string;
    index: number;
    label: string;
    eventId: string;
    eventSlug: string;
    status: ChapterStatus;
  };
  myMarks: ParticipantMark[];
  bloom: {
    index: number;
    total: number;
    energy: number;
    frame: WorldStoryboardFrame;
  } | null;
  /** Phase B: whether fans can contribute right now (chapter open or between-show). */
  window: {
    mode: "chapter" | "between" | "closed";
    canContribute: boolean;
    message: string;
  };
  /** When snapshot was rebuilt for a historical `at` / `version` query. */
  asOf: string | null;
  /** Fans schematic zones from brand kit + live zone vitality from state. */
  zones: Array<ZoneDef & { runtime: ZoneRuntimeState | null; sponsor: SponsorDef | null }>;
};

export type WorldMutationIntent = {
  gardenId: string;
  chapterId: string | null;
  kind: ContributionKind;
  sourceType: GardenSourceType;
  sourceId: string;
  deviceId: string | null;
  /** Chapter show index (1-based) for landmark thresholds; optional. */
  chapterIndex?: number | null;
  chapterWeight?: number;
  /** When set, skips damping math and uses this weight directly (replay / finale). */
  forcedWeight?: number;
  /** Fans zone key — scopes growth onto the schematic map. */
  zoneKey?: string | null;
  /** Recent mutation timestamps for this device (ISO), newest last — for damping. */
  recentDeviceMutationAts?: string[];
};

/** Curated gameday deliverable shelf — ready for board / PA / social. */
export type GamedayMomentType =
  | "kickoff"
  | "goal"
  | "halftime"
  | "timeout"
  | "walkup"
  | "rivalry"
  | "general";

export type GamedayReadyItem = {
  id: string;
  gardenId: string;
  title: string;
  momentType: GamedayMomentType;
  zoneKey: string | null;
  sponsorKey: string | null;
  sourceType: GardenSourceType | "manual";
  sourceId: string | null;
  note: string | null;
  /** Snapshot fragment useful for ops (energy, zone, landmark labels). */
  payload: Record<string, unknown>;
  status: "ready" | "played" | "archived";
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};

export const CONTRIBUTION_KINDS: ContributionKind[] = [
  "text",
  "voice",
  "video",
  "percussion",
  "vocal",
  "other",
];

export const DEFAULT_BRAND_PRIMARY = "#1a0f2d";
export const DEFAULT_BRAND_ACCENT = "#CFFF81";

export function defaultMapPlate(partial?: Partial<MapPlateMeta> | null): MapPlateMeta {
  const refs = Array.isArray(partial?.referenceUrls)
    ? partial!.referenceUrls!
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const variants = normalizeMapPlateVariants(partial?.variants);
  const activeRaw = partial?.activeVariantKey;
  const activeVariantKey =
    typeof activeRaw === "string" && MAP_PLATE_VARIANT_KEYS.includes(activeRaw as MapPlateVariantKey)
      ? (activeRaw as MapPlateVariantKey)
      : null;
  return {
    referenceUrls: refs,
    vibePrompt: typeof partial?.vibePrompt === "string" ? partial.vibePrompt.trim() : "",
    venueNotes: typeof partial?.venueNotes === "string" ? partial.venueNotes.trim() : "",
    // Default on when unset — twin is the Fans product intent.
    twinMode: partial?.twinMode !== false,
    draftUrl: partial?.draftUrl?.trim() || null,
    draftGeneratedAt: partial?.draftGeneratedAt?.trim() || null,
    pinnedAt: partial?.pinnedAt?.trim() || null,
    seasonLabel: typeof partial?.seasonLabel === "string" ? partial.seasonLabel.trim() : "",
    layoutGuided: Boolean(partial?.layoutGuided),
    layoutSchematicUrl: partial?.layoutSchematicUrl?.trim() || null,
    ambientVideoUrl: partial?.ambientVideoUrl?.trim() || null,
    ambientVideoGeneratedAt: partial?.ambientVideoGeneratedAt?.trim() || null,
    variants,
    activeVariantKey,
  };
}

function normalizeMapPlateVariants(
  variants: MapPlateVariant[] | null | undefined
): MapPlateVariant[] {
  if (!Array.isArray(variants)) return [];
  const out: MapPlateVariant[] = [];
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    const key = v.key as MapPlateVariantKey;
    if (!MAP_PLATE_VARIANT_KEYS.includes(key) || key === "default") continue;
    if (seen.has(key)) continue;
    const stillUrl = typeof v.stillUrl === "string" ? v.stillUrl.trim() : "";
    if (!stillUrl) continue;
    seen.add(key);
    out.push({
      key,
      label: (typeof v.label === "string" && v.label.trim()) || MAP_PLATE_VARIANT_LABELS[key],
      stillUrl,
      videoUrl: v.videoUrl?.trim() || null,
      generatedAt: v.generatedAt?.trim() || new Date(0).toISOString(),
    });
  }
  return out;
}

/** Public map still URL: active matchday variant, else pinned hero. */
export function resolveMapPlateStillUrl(brand: Pick<BrandKit, "heroArtworkUrl" | "mapPlate">): string | null {
  const key = brand.mapPlate.activeVariantKey;
  if (key && key !== "default") {
    const variant = brand.mapPlate.variants.find((v) => v.key === key);
    if (variant?.stillUrl) return variant.stillUrl;
  }
  return brand.heroArtworkUrl?.trim() || null;
}

/** Public map ambient video: active variant loop, else season ambient. */
export function resolveMapPlateVideoUrl(brand: Pick<BrandKit, "mapPlate">): string | null {
  const key = brand.mapPlate.activeVariantKey;
  if (key && key !== "default") {
    const variant = brand.mapPlate.variants.find((v) => v.key === key);
    if (variant?.videoUrl) return variant.videoUrl;
  }
  return brand.mapPlate.ambientVideoUrl?.trim() || null;
}

export function defaultBrandKit(partial?: Partial<BrandKit>): BrandKit {
  const mapPlate = defaultMapPlate(partial?.mapPlate);
  return {
    title: partial?.title?.trim() || "Song Garden",
    logoUrl: partial?.logoUrl?.trim() || null,
    primaryColor: partial?.primaryColor?.trim() || DEFAULT_BRAND_PRIMARY,
    accentColor: partial?.accentColor?.trim() || DEFAULT_BRAND_ACCENT,
    heroArtworkUrl: partial?.heroArtworkUrl?.trim() || null,
    animationPreset: partial?.animationPreset || "particles",
    ambientSoundtrackUrl: partial?.ambientSoundtrackUrl?.trim() || null,
    bloomStoryboard: Array.isArray(partial?.bloomStoryboard) ? partial!.bloomStoryboard! : [],
    zones: normalizeZones(partial?.zones),
    sponsors: normalizeSponsors(partial?.sponsors),
    mapPlate,
    atmosphere: partial?.atmosphere
      ? defaultAtmosphere(partial.atmosphere)
      : resolveAtmosphere({
          heroArtworkUrl: partial?.heroArtworkUrl ?? null,
          mapPlate,
        }),
    presenceEyebrow:
      typeof partial?.presenceEyebrow === "string" && partial.presenceEyebrow.trim()
        ? partial.presenceEyebrow.trim()
        : null,
    presenceMessage:
      typeof partial?.presenceMessage === "string" && partial.presenceMessage.trim()
        ? partial.presenceMessage.trim()
        : null,
  };
}

/** Shallow brand patch with deep-merge for `mapPlate` + `atmosphere`. */
export function mergeBrandKit(existing: BrandKit, patch: Partial<BrandKit>): BrandKit {
  return defaultBrandKit({
    ...existing,
    ...patch,
    mapPlate: {
      ...existing.mapPlate,
      ...(patch.mapPlate ?? {}),
    },
    atmosphere: patch.atmosphere
      ? defaultAtmosphere({ ...existing.atmosphere, ...patch.atmosphere })
      : existing.atmosphere,
  });
}

function normalizeZones(zones: ZoneDef[] | null | undefined): ZoneDef[] {
  if (!Array.isArray(zones)) return [];
  return zones
    .filter((z) => z && typeof z.key === "string" && z.key.trim())
    .map((z) => ({
      key: z.key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      label: (z.label || z.key).trim(),
      sponsorKey: z.sponsorKey?.trim() || null,
      x: clamp01(Number(z.x) || 0.5),
      y: clamp01(Number(z.y) || 0.5),
      logoUrl: z.logoUrl?.trim() || null,
      hit: normalizeHit(z.hit),
      blurb: z.blurb?.trim() || null,
      prompt: z.prompt?.trim() || null,
      ctaLabel: z.ctaLabel?.trim() || null,
      inputPlaceholder: z.inputPlaceholder?.trim() || null,
    }))
    .filter((z) => z.key);
}

function normalizeHit(hit: ZoneHitRegion | null | undefined): ZoneHitRegion | null {
  if (!hit || typeof hit !== "object") return null;
  if (hit.type === "circle") {
    const r = Number(hit.r);
    if (!Number.isFinite(r) || r <= 0) return null;
    return { type: "circle", r: Math.max(0.02, Math.min(0.45, r)) };
  }
  if (hit.type === "polygon" && Array.isArray(hit.points)) {
    const points = hit.points
      .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
      .map((p) => ({ x: clamp01(Number(p.x)), y: clamp01(Number(p.y)) }));
    if (points.length < 3) return null;
    return { type: "polygon", points };
  }
  return null;
}

/** Effective hit region for interaction — authored hit or fallback circle at the label. */
export function zoneHitRegion(zone: Pick<ZoneDef, "x" | "y" | "hit">): ZoneHitRegion {
  if (zone.hit) return zone.hit;
  return { type: "circle", r: 0.07 };
}

export function pointInZoneHit(
  px: number,
  py: number,
  zone: Pick<ZoneDef, "x" | "y" | "hit">
): boolean {
  const hit = zoneHitRegion(zone);
  if (hit.type === "circle") {
    const dx = px - zone.x;
    const dy = py - zone.y;
    return dx * dx + dy * dy <= hit.r * hit.r;
  }
  // Ray casting
  const pts = hit.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function normalizeSponsors(sponsors: SponsorDef[] | null | undefined): SponsorDef[] {
  if (!Array.isArray(sponsors)) return [];
  return sponsors
    .filter((s) => s && typeof s.key === "string" && s.key.trim() && s.name?.trim())
    .map((s) => ({
      key: s.key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      name: s.name.trim(),
      logoUrl: s.logoUrl?.trim() || null,
      credit: s.credit?.trim() || null,
    }))
    .filter((s) => s.key);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function defaultMutationPolicy(partial?: Partial<MutationPolicy>): MutationPolicy {
  return {
    energyPerContribution: partial?.energyPerContribution ?? 0.012,
    energyCap: partial?.energyCap ?? 1,
    layerGain: partial?.layerGain ?? 0.02,
    layerCap: partial?.layerCap ?? 1,
    chapterWeightDefault: partial?.chapterWeightDefault ?? 1,
    betweenChapterWeight: partial?.betweenChapterWeight ?? 0.5,
    chapterFinaleWeight: partial?.chapterFinaleWeight ?? 1.5,
    landmarks: Array.isArray(partial?.landmarks)
      ? partial!.landmarks!
      : [
          { key: "north_grove", label: "North Grove", minEnergy: 0.2 },
          { key: "choir_clearing", label: "Choir Clearing", minEnergy: 0.45 },
          { key: "full_bloom", label: "Full Bloom", minEnergy: 0.75 },
        ],
    maxNodes: partial?.maxNodes ?? 240,
    nodeWeight: partial?.nodeWeight ?? 1,
    deviceDamping: {
      windowMinutes: partial?.deviceDamping?.windowMinutes ?? 30,
      afterCount: partial?.deviceDamping?.afterCount ?? 5,
      factor: partial?.deviceDamping?.factor ?? 0.35,
    },
  };
}

export function emptyWorldState(renderSeed: string, now = new Date().toISOString()): WorldState {
  return {
    version: 0,
    updatedAt: now,
    energy: 0,
    totals: {
      contributions: 0,
      participants: 0,
      byKind: {},
    },
    field: { nodes: [], nextIndex: 0 },
    landmarks: [],
    layers: {
      text: 0,
      voice: 0,
      video: 0,
      percussion: 0,
      vocal: 0,
      other: 0,
    },
    chapters: { completedIds: [], activeChapterId: null },
    zones: {},
    renderSeed,
  };
}

export function isContributionKind(value: unknown): value is ContributionKind {
  return typeof value === "string" && (CONTRIBUTION_KINDS as string[]).includes(value);
}

export function effectCelebrationLine(effects: WorldEffect[]): string | null {
  const landmark = effects.find((e) => e.type === "landmark_unlocked");
  if (landmark && landmark.type === "landmark_unlocked") {
    return `${landmark.label} opened in the garden`;
  }
  const zone = effects.find((e) => e.type === "zone_up");
  if (zone && zone.type === "zone_up") {
    return "A zone grew louder";
  }
  const layer = effects.find((e) => e.type === "layer_up");
  if (layer && layer.type === "layer_up") {
    return "The garden grew louder";
  }
  if (effects.some((e) => e.type === "energy_up")) {
    return "The garden stirred";
  }
  return null;
}

export type MerchFormat = "hoodie_front" | "hoodie_allover" | "square_print";

export type MerchRenderInput = {
  brand: Pick<BrandKit, "primaryColor" | "accentColor" | "logoUrl" | "title">;
  state: Pick<WorldState, "energy" | "layers" | "landmarks" | "totals" | "renderSeed"> & {
    version?: number;
  };
  personal?: { kinds: ContributionKind[]; count: number };
  format: MerchFormat;
};

/** Frozen print contract stored on an edition pin. */
export type PinnedMerchSnapshot = {
  gardenId: string;
  gardenSlug: string;
  title: string;
  worldVersion: number;
  brand: MerchRenderInput["brand"];
  state: MerchRenderInput["state"];
  pinnedAt: string;
};

export type GardenEdition = {
  id: string;
  gardenId: string;
  slug: string;
  label: string;
  pinnedSnapshot: PinnedMerchSnapshot;
  renderSeed: string;
  pinnedAt: string;
};

export type GardenOrderKind = "edition" | "living";
export type GardenOrderStatus = "stub" | "queued" | "fulfilled";

/** Stub checkout line — holds the ordered snapshot blob for later print fulfillment. */
export type GardenOrder = {
  id: string;
  gardenId: string;
  kind: GardenOrderKind;
  editionId: string | null;
  editionSlug: string | null;
  format: MerchFormat;
  deviceId: string | null;
  /** Frozen snapshot at purchase time — print must use this, not live world. */
  orderedSnapshot: PinnedMerchSnapshot;
  merchInput: MerchRenderInput;
  status: GardenOrderStatus;
  note: string | null;
  createdAt: string;
};

export const MERCH_FORMATS: MerchFormat[] = ["hoodie_front", "hoodie_allover", "square_print"];

export function isMerchFormat(value: unknown): value is MerchFormat {
  return typeof value === "string" && (MERCH_FORMATS as string[]).includes(value);
}
