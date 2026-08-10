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

export type BrandKit = {
  title: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
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
};

export type ZoneDef = {
  key: string;
  label: string;
  /** Optional sponsor owning/enabling this zone */
  sponsorKey?: string | null;
  /** 0..1 position on schematic map */
  x: number;
  y: number;
  /** Short hint shown on the public map */
  blurb?: string | null;
  /**
   * Fan-facing prompt for this zone (chant idea, check-in, etc.).
   * The map interaction surface shows this when the zone is selected.
   */
  prompt?: string | null;
  /** Primary CTA label, e.g. "Leave a mark" / "Share your chant" */
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

export function defaultBrandKit(partial?: Partial<BrandKit>): BrandKit {
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
  };
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
      blurb: z.blurb?.trim() || null,
      prompt: z.prompt?.trim() || null,
      ctaLabel: z.ctaLabel?.trim() || null,
      inputPlaceholder: z.inputPlaceholder?.trim() || null,
    }))
    .filter((z) => z.key);
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
