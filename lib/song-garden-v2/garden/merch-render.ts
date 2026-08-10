import type {
  BrandKit,
  ContributionKind,
  Garden,
  GardenEdition,
  MerchFormat,
  MerchRenderInput,
  ParticipantMark,
  PinnedMerchSnapshot,
  WorldState,
} from "./types";

/** Stable 32-bit hash for deterministic layout from render seeds. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function merchDimensions(format: MerchFormat): { width: number; height: number } {
  if (format === "hoodie_allover") return { width: 1200, height: 1200 };
  if (format === "hoodie_front") return { width: 900, height: 1000 };
  return { width: 800, height: 800 };
}

export function buildMerchRenderInput(args: {
  brand: BrandKit | MerchRenderInput["brand"];
  state: Pick<WorldState, "energy" | "layers" | "landmarks" | "totals" | "renderSeed"> & {
    version?: number;
  };
  format: MerchFormat;
  personalMarks?: ParticipantMark[] | null;
}): MerchRenderInput {
  const personal = args.personalMarks?.length
    ? {
        kinds: Array.from(new Set(args.personalMarks.map((m) => m.kind))) as ContributionKind[],
        count: args.personalMarks.length,
      }
    : undefined;

  return {
    brand: {
      title: args.brand.title,
      primaryColor: args.brand.primaryColor,
      accentColor: args.brand.accentColor,
      logoUrl: "logoUrl" in args.brand ? args.brand.logoUrl ?? null : null,
    },
    state: {
      energy: args.state.energy,
      layers: args.state.layers,
      landmarks: args.state.landmarks,
      totals: args.state.totals,
      renderSeed: args.state.renderSeed,
      version: args.state.version,
    },
    personal,
    format: args.format,
  };
}

export function buildPinnedMerchSnapshot(args: {
  garden: Garden;
  state?: WorldState;
  worldVersion?: number;
  now?: string;
}): PinnedMerchSnapshot {
  const state = args.state ?? args.garden.worldState;
  const now = args.now ?? new Date().toISOString();
  return {
    gardenId: args.garden.id,
    gardenSlug: args.garden.slug,
    title: args.garden.title,
    worldVersion: args.worldVersion ?? args.garden.worldVersion,
    brand: {
      title: args.garden.brandKit.title || args.garden.title,
      primaryColor: args.garden.brandKit.primaryColor,
      accentColor: args.garden.brandKit.accentColor,
      logoUrl: args.garden.brandKit.logoUrl,
    },
    state: {
      energy: state.energy,
      layers: state.layers,
      landmarks: state.landmarks,
      totals: state.totals,
      renderSeed: state.renderSeed,
      version: state.version,
    },
    pinnedAt: now,
  };
}

export function editionToMerchInput(
  edition: GardenEdition,
  format: MerchFormat,
  personalMarks?: ParticipantMark[] | null
): MerchRenderInput {
  return buildMerchRenderInput({
    brand: edition.pinnedSnapshot.brand,
    state: {
      ...edition.pinnedSnapshot.state,
      renderSeed: edition.renderSeed || edition.pinnedSnapshot.state.renderSeed,
    },
    format,
    personalMarks,
  });
}

/** Deterministic decorative nodes for merch art (not the live garden field). */
export function merchDecorNodes(
  input: MerchRenderInput,
  count = 24
): Array<{ x: number; y: number; r: number; kind: ContributionKind | "seed" }> {
  const seed = `${input.state.renderSeed}:${input.format}:${input.state.version ?? 0}:${input.personal?.count ?? 0}`;
  let h = hashSeed(seed);
  const kinds: Array<ContributionKind | "seed"> = [
    "percussion",
    "vocal",
    "text",
    "voice",
    "video",
    "other",
    "seed",
  ];
  const nodes: Array<{ x: number; y: number; r: number; kind: ContributionKind | "seed" }> = [];
  const n = Math.max(8, Math.min(count, 8 + Math.round(input.state.energy * 20)));
  for (let i = 0; i < n; i += 1) {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0;
    const angle = ((i * 137.50776) % 360) * (Math.PI / 180);
    const radius = 0.12 + (Math.sqrt(i + 1) / Math.sqrt(n + 1)) * 0.38;
    const jitter = ((h % 1000) / 1000 - 0.5) * 0.04;
    nodes.push({
      x: 0.5 + Math.cos(angle) * (radius + jitter),
      y: 0.5 + Math.sin(angle) * (radius + jitter) * 1.15,
      r: 0.012 + ((h >> 8) % 100) / 4000 + (input.personal ? 0.004 : 0),
      kind: kinds[i % kinds.length],
    });
  }
  return nodes;
}

export function layerMixLabel(layers: WorldState["layers"]): string {
  const entries = Object.entries(layers).sort((a, b) => Number(b[1]) - Number(a[1]));
  const top = entries.slice(0, 2).filter(([, v]) => Number(v) > 0.05);
  if (!top.length) return "dormant field";
  return top.map(([k, v]) => `${k} ${Math.round(Number(v) * 100)}%`).join(" · ");
}
