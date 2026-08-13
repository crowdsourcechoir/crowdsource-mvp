import type { Event } from "@/data/mockEvents";

export type WorldAnimationPreset = "particles" | "aurora" | "glow" | "none";

/**
 * A single frame of the world's growth arc. `threshold` is the minimum energyLevel
 * (0..1, i.e. % of the journey completed) at which this scene becomes active —
 * the world crossfades to the highest-threshold stage the participant has reached,
 * so the *place itself* visibly evolves as contributions come in, not just ambient FX.
 */
export type WorldSceneStage = {
  threshold: number;
  sceneUrl: string;
};

/**
 * One frame of a fixed, hand-authored "storyboard" — a small, known set of world
 * states (dormant → awakening → ... → full bloom) instead of a continuously
 * blended curve. Deterministic: the same journey progress always lands on the
 * same frame, every time, for every participant — which is what makes a short
 * (~5-moment) journey feel intentional/choreographed rather than randomly paced.
 * `videoUrl` (a short seamless loop) takes priority over `sceneUrl` (a static
 * fallback/poster) when present — this is the "the image itself moves" layer.
 */
export type WorldStoryboardFrame = {
  sceneUrl: string | null;
  videoUrl: string | null;
  /** 0..1 — how strong the ambient energy field should be while this frame is active. Defaults to the frame's position in the sequence if omitted. */
  energy?: number;
};

/** Lightweight, additive world configuration. Every field has a derived default — nothing here is required. */
export type WorldConfig = {
  title: string;
  heroArtworkUrl: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  animationPreset: WorldAnimationPreset;
  ambientSoundtrackUrl: string | null;
  /** Reserved for future AI artwork generation — explicitly out of scope this pass. */
  aiArtworkPrompt: string | null;
  /** Ordered ascending by threshold. Empty means "just use heroArtworkUrl, no growth crossfade." Legacy continuous-blend mechanic — superseded by worldStoryboard when present, kept for back-compat. */
  worldSceneStages: WorldSceneStage[];
  /** Ordered sequence of fixed world states. When present, takes priority over worldSceneStages/heroArtworkUrl. */
  worldStoryboard: WorldStoryboardFrame[];
  /** When true, ambient "others are here" activity lines may blend in simulated lines if real traffic is sparse. */
  presenceSimulationEnabled: boolean;
};

export const DEFAULT_PRIMARY_COLOR = "#1a0f2d";
export const DEFAULT_ACCENT_COLOR = "#CFFF81";

export const WORLD_ANIMATION_PRESETS: { id: WorldAnimationPreset; label: string }[] = [
  { id: "particles", label: "Particles (drifting light)" },
  { id: "aurora", label: "Aurora (soft moving glow bands)" },
  { id: "glow", label: "Glow (slow pulsing radial light)" },
  { id: "none", label: "None (static)" },
];

/** Derives a complete world config from an event's existing fields — zero setup required. */
export function defaultWorldConfig(event: Pick<Event, "title" | "heroImage">): WorldConfig {
  return {
    title: event.title,
    heroArtworkUrl: event.heroImage || null,
    logoUrl: null,
    primaryColor: DEFAULT_PRIMARY_COLOR,
    accentColor: DEFAULT_ACCENT_COLOR,
    animationPreset: "particles",
    ambientSoundtrackUrl: null,
    aiArtworkPrompt: null,
    worldSceneStages: [],
    worldStoryboard: [],
    presenceSimulationEnabled: true,
  };
}

/** Merges a partial, possibly-null override (from the DB) over the event-derived defaults. */
export function resolveWorldConfig(
  event: Pick<Event, "title" | "heroImage" | "worldConfig">
): WorldConfig {
  const defaults = defaultWorldConfig(event);
  const override = event.worldConfig;
  if (!override) return defaults;

  return {
    title: override.title?.trim() || defaults.title,
    heroArtworkUrl: override.heroArtworkUrl?.trim() || defaults.heroArtworkUrl,
    logoUrl: override.logoUrl?.trim() || defaults.logoUrl,
    primaryColor: override.primaryColor?.trim() || defaults.primaryColor,
    accentColor: override.accentColor?.trim() || defaults.accentColor,
    animationPreset: override.animationPreset || defaults.animationPreset,
    ambientSoundtrackUrl: override.ambientSoundtrackUrl?.trim() || defaults.ambientSoundtrackUrl,
    aiArtworkPrompt: override.aiArtworkPrompt?.trim() || defaults.aiArtworkPrompt,
    worldSceneStages: sortedSceneStages(override.worldSceneStages) ?? defaults.worldSceneStages,
    worldStoryboard: cleanedStoryboard(override.worldStoryboard) ?? defaults.worldStoryboard,
    presenceSimulationEnabled:
      override.presenceSimulationEnabled ?? defaults.presenceSimulationEnabled,
  };
}

function cleanedStoryboard(
  frames: WorldStoryboardFrame[] | null | undefined
): WorldStoryboardFrame[] | null {
  if (!frames?.length) return null;
  const cleaned = frames
    .map((f) => ({
      sceneUrl: f?.sceneUrl?.trim() || null,
      videoUrl: f?.videoUrl?.trim() || null,
      energy: typeof f?.energy === "number" ? Math.max(0, Math.min(1, f.energy)) : undefined,
    }))
    .filter((f) => f.sceneUrl || f.videoUrl);
  return cleaned.length ? cleaned : null;
}

function sortedSceneStages(stages: WorldSceneStage[] | null | undefined): WorldSceneStage[] | null {
  if (!stages?.length) return null;
  const cleaned = stages
    .filter((s) => s?.sceneUrl?.trim())
    .map((s) => ({
      threshold: Math.max(0, Math.min(1, Number(s.threshold) || 0)),
      sceneUrl: s.sceneUrl.trim(),
    }))
    .sort((a, b) => a.threshold - b.threshold);
  return cleaned.length ? cleaned : null;
}

/** Picks the highest-threshold scene the participant has reached; falls back to heroArtworkUrl. */
export function resolveWorldSceneUrl(world: WorldConfig, energyLevel: number): string | null {
  if (!world.worldSceneStages.length) return world.heroArtworkUrl;
  let active = world.worldSceneStages[0].sceneUrl;
  for (const stage of world.worldSceneStages) {
    if (energyLevel >= stage.threshold) active = stage.sceneUrl;
  }
  return active;
}

/**
 * A continuous blend between the two growth-stage scenes bracketing the
 * participant's current progress. `t` is how far between `lower` and `upper`
 * they've traveled (0..1) — every contribution nudges `energyLevel`, which
 * nudges `t`, which nudges the crossfade. This is what makes the world visibly
 * shift a little on *every* step instead of jumping once at a single threshold.
 */
export type WorldSceneBlend = {
  lower: WorldSceneStage;
  upper: WorldSceneStage | null;
  t: number;
};

export type ResolvedStoryboardFrame = {
  frame: WorldStoryboardFrame;
  index: number;
  total: number;
  /** 0..1 — the frame's own energy value if set, else its position in the sequence. */
  energy: number;
};

/**
 * Snaps journey progress to one discrete storyboard frame — no blending, no
 * in-between states. `energyLevel` (0..1, already = completed/total steps) is
 * bucketed into `frames.length` equal slices, so a short journey (e.g. 5
 * moments mapped to 6 frames) moves through the *entire* storyboard, and a
 * longer one just holds each frame for more steps. Same progress ⇒ same
 * frame, every time — the "prescriptive/repeatable" behavior the experience
 * is built around.
 */
export function resolveStoryboardFrame(
  world: WorldConfig,
  energyLevel: number
): ResolvedStoryboardFrame | null {
  const frames = world.worldStoryboard;
  if (!frames.length) return null;
  const clamped = Math.max(0, Math.min(1, energyLevel));
  const index = Math.min(frames.length - 1, Math.floor(clamped * frames.length));
  return resolveStoryboardFrameAtIndex(world, index);
}

/** Pick a specific storyboard plate by index (prompt-tied background). */
export function resolveStoryboardFrameAtIndex(
  world: WorldConfig,
  frameIndex: number
): ResolvedStoryboardFrame | null {
  const frames = world.worldStoryboard;
  if (!frames.length) return null;
  const index = Math.max(0, Math.min(frames.length - 1, Math.floor(frameIndex)));
  const frame = frames[index];
  const energy = frame.energy ?? (frames.length > 1 ? index / (frames.length - 1) : 1);
  return { frame, index, total: frames.length, energy };
}

export function resolveWorldSceneBlend(world: WorldConfig, energyLevel: number): WorldSceneBlend | null {
  const stages = world.worldSceneStages;
  if (!stages.length) return null;

  let lowerIndex = 0;
  for (let i = 0; i < stages.length; i += 1) {
    if (energyLevel >= stages[i].threshold) lowerIndex = i;
  }
  const lower = stages[lowerIndex];
  const upper = stages[lowerIndex + 1] ?? null;
  if (!upper) return { lower, upper: null, t: 0 };

  const span = upper.threshold - lower.threshold;
  const t = span > 0 ? Math.max(0, Math.min(1, (energyLevel - lower.threshold) / span)) : 0;
  return { lower, upper, t };
}

/** Normalizes a raw partial world config (e.g. from an admin form) before saving. */
export function normalizeWorldConfigInput(
  input: Partial<WorldConfig> | null | undefined
): WorldConfig | null {
  if (!input) return null;
  const cleaned: WorldConfig = {
    title: input.title?.trim() || "",
    heroArtworkUrl: input.heroArtworkUrl?.trim() || null,
    logoUrl: input.logoUrl?.trim() || null,
    primaryColor: input.primaryColor?.trim() || DEFAULT_PRIMARY_COLOR,
    accentColor: input.accentColor?.trim() || DEFAULT_ACCENT_COLOR,
    animationPreset: input.animationPreset ?? "particles",
    ambientSoundtrackUrl: input.ambientSoundtrackUrl?.trim() || null,
    aiArtworkPrompt: input.aiArtworkPrompt?.trim() || null,
    worldSceneStages: sortedSceneStages(input.worldSceneStages) ?? [],
    worldStoryboard: cleanedStoryboard(input.worldStoryboard) ?? [],
    presenceSimulationEnabled: input.presenceSimulationEnabled ?? true,
  };
  const isEmpty =
    !cleaned.title &&
    !cleaned.heroArtworkUrl &&
    !cleaned.logoUrl &&
    !cleaned.ambientSoundtrackUrl &&
    !cleaned.aiArtworkPrompt &&
    !cleaned.worldSceneStages.length &&
    !cleaned.worldStoryboard.length &&
    cleaned.presenceSimulationEnabled &&
    cleaned.primaryColor === DEFAULT_PRIMARY_COLOR &&
    cleaned.accentColor === DEFAULT_ACCENT_COLOR &&
    cleaned.animationPreset === "particles";
  return isEmpty ? null : cleaned;
}
