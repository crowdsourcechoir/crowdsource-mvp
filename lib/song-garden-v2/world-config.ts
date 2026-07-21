import type { Event } from "@/data/mockEvents";

export type WorldAnimationPreset = "particles" | "aurora" | "glow" | "none";

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
  };
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
  };
  const isEmpty =
    !cleaned.title &&
    !cleaned.heroArtworkUrl &&
    !cleaned.logoUrl &&
    !cleaned.ambientSoundtrackUrl &&
    !cleaned.aiArtworkPrompt &&
    cleaned.primaryColor === DEFAULT_PRIMARY_COLOR &&
    cleaned.accentColor === DEFAULT_ACCENT_COLOR &&
    cleaned.animationPreset === "particles";
  return isEmpty ? null : cleaned;
}
